import {createProjectInvitationSchema, getProjectInvitationSchema, getAllProjectInvitationsSchema, deleteProjectInvitationSchema, acceptProjectInvitationSchema, updateProjectInvitationSchema} from "./validators/project-invitations";
import { ZodReqWithUser } from "../types";
import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import b62 from "base62-random";
import { debugError } from "../debug.js";
import conductorErrors from "../conductor-errors.js";
import authAPI from './auth.js';
import ProjectInvitation from "../models/projectinvitation";
import Project from '../models/project.js';
import User from "../models/user";
import mailAPI from './mail.js';
import { getSubdomainFromLibrary } from '../util/librariesclient.js';
import {
  updateTeamWorkbenchPermissions,
} from '../util/projectutils.js';
import { SanitizedUserSelectProjection, SanitizedUserSelectQuery } from "../models/user.js";

const checkProjectAdminPermission = (project:any, user:any) => {
    let projAdmins: any[] = [];
    let userUUID = '';
    if (typeof (user) === 'string') userUUID = user;
    else if (typeof (user) === 'object') {
        if (user.uuid !== undefined) userUUID = user.uuid;
        else if (user.decoded?.uuid !== undefined) userUUID = user.decoded.uuid;
    }
    if (typeof (project.leads) !== 'undefined' && Array.isArray(project.leads)) {
        projAdmins = [...projAdmins, ...project.leads];
    }
    if (typeof (project.liaisons) !== 'undefined' && Array.isArray(project.liaisons)) {
        projAdmins = [...projAdmins, ...project.liaisons];
    }

    if (userUUID !== '') {
        let foundUser = projAdmins.find((item) => {
            if (typeof (item) === 'string') {
                return item === userUUID;
            } else if (typeof (item) === 'object') {
                return item.uuid === userUUID;
            }
            return false;
        });
        if (foundUser !== undefined) {
            return true; 
        } else {
            return authAPI.checkHasRole(user, 'libretexts', 'superadmin');
        }
    }
    return false;
};

const constructProjectTeam = (project:any, exclude?:any) => {
  let projTeam: any = [];
  if (typeof (project.leads) !== 'undefined' && Array.isArray(project.leads)) {
      projTeam = [...projTeam, ...project.leads];
  }
  if (typeof (project.liaisons) !== 'undefined' && Array.isArray(project.liaisons)) {
      projTeam = [...projTeam, ...project.liaisons];
  }
  if (typeof (project.members) !== 'undefined' && Array.isArray(project.members)) {
      projTeam = [...projTeam, ...project.members];
  }
  if (typeof (project.auditors) !== 'undefined' && Array.isArray(project.auditors)) {
      projTeam = [...projTeam, ...project.auditors];
  }
  if (typeof (exclude) !== 'undefined') {
      projTeam = projTeam.filter((item:any) => {
          if (typeof (exclude) === 'string') {
              if (typeof (item) === 'string') {
                  return item !== exclude;
              } else if (typeof (item) === 'object') {
                  return item.uuid !== exclude;
              }
          } else if (typeof (exclude) === 'object' && Array.isArray(exclude)) {
              if (typeof (item) === 'string') {
                  return !exclude.includes(item);
              } else if (typeof (item) === 'object' && typeof (item.uuid) !== 'undefined') {
                  return !exclude.includes(item.uuid);
              }
          }
          return false;
      });
  }
  return projTeam;
};

async function _addMemberToProjectInternal(
  projectID: string,
  uuid: string,
  user: any 
): Promise<string> {
  const project = await Project.findOne({ projectID }).lean();
  if (!project) {
    throw new Error(conductorErrors.err11); 
  }

  if (!checkProjectAdminPermission(project, user)) {
    throw new Error(conductorErrors.err8); 
  }

  const projectTeam = constructProjectTeam(project);
  if (projectTeam.includes(uuid)) {
    return 'User is already a team member.';
  }

  const targetUser = await User.findOne({ uuid }).lean();
  if (!targetUser) {
    throw new Error(conductorErrors.err7); 
  }

  const updateRes = await Project.updateOne(
    { projectID },
    { $addToSet: { members: uuid } }
  );
  if (updateRes.modifiedCount !== 1) {
    throw new Error('Project update failed.');
  }

  const updatedProject = await Project.findOne({ projectID });
  if (!updatedProject) {
    throw new Error('Error finding updated project.');
  }

  const updatedTeam = constructProjectTeam(updatedProject);

  if (
    updatedProject.didCreateWorkbench &&
    updatedProject.libreLibrary &&
    updatedProject.libreCoverID
  ) {
    const subdomain = getSubdomainFromLibrary(updatedProject.libreLibrary);
    if (!subdomain) {
      throw new Error('Invalid library');
    }
    await updateTeamWorkbenchPermissions(
      projectID,
      subdomain,
      updatedProject.libreCoverID
    );
  }

  const foundTeam = await User.find({ uuid: { $in: updatedTeam } }, '-_id email');
  if (!foundTeam) {
    throw new Error('Error finding updated members.');
  }

  const teamEmails = foundTeam.map((member) => member.email);
  const emailPromises = teamEmails.map((e) =>
    mailAPI.sendAddedAsMemberNotification(
      targetUser.firstName,
      e,
      projectID,
      project.title
    )
  );
  await Promise.all(emailPromises).catch((e) => {
    debugError(`Error sending Team Member Added notification email: ${e}`);
  });

  return 'Successfully added user as team member!';
}


export async function createProjectInvitation(
  req: ZodReqWithUser<z.infer<typeof createProjectInvitationSchema>>,
  res: Response
) {
  try{

    const { projectID } = req.params;
    const { email, role } = req.body;
    if (!projectID || !email || !role) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err1,
      });
    }

    const senderID = req.user.decoded.uuid;

    const sender = await User.findOne({ uuid: senderID }).select("firstName lastName").lean();
    if (!sender) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err7,
      });
    }

  
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const isAdmin = checkProjectAdminPermission(project, req.user);
    if (!isAdmin) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const existingAcceptedInvitation = await ProjectInvitation.findOne({
      projectID,
      email,
      accepted: true,
    });
    if (existingAcceptedInvitation) {
      return res.status(409).send({
        err: true,
        errMsg: conductorErrors.err47,
      });
    }

    const existingInvitation = await ProjectInvitation.findOne({
      projectID,
      email,
    });
    if (existingInvitation) {
      await ProjectInvitation.deleteOne({ _id: existingInvitation._id });
    }

    const newInvitation = new ProjectInvitation({
      projectID,
      senderID,
      email,
      role,
    });
    await newInvitation.save();

    mailAPI.sendProjectInvitation(email, sender.firstName, sender.lastName, project.title, newInvitation.inviteID, newInvitation.token);
  
    const { _id, token, __v, ...responseInvitation } = newInvitation.toObject();

    return res.send({
      err: false,
      responseInvitation
    });
  }
  catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

export async function getProjectInvitation(req: ZodReqWithUser<z.infer<typeof getProjectInvitationSchema>>, res: Response) {
  try{
    const { inviteID } = req.params;
    const { token } = req.query;
    if (!inviteID || !token) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err1,
      });
    }

    const invitation = await ProjectInvitation.findOne({ inviteID, token })
    .select("-token -_id -__v")
    .populate({
      path: "project",
      select: "title -_id", 
    })
    .populate({
      path: "sender",
      select: "firstName lastName -_id"
    })
    .lean();


    if (!invitation) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err69
      });
    }
    
    if (new Date() > new Date(invitation.expires)) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err69,
      });
    }

    return res.status(200).send({
      err: false,
      invitation
    });
    
  }
  catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

export async function getAllInvitationsForProject(req: ZodReqWithUser<z.infer<typeof getAllProjectInvitationsSchema>>, res: Response){
  try{
    const { projectID } = req.params;
    if (!projectID) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err1,
      });
    }

    const page = req.query.page? parseInt(req.query.page.toString()) : 1;
    const limit = req.query.limit? parseInt(req.query.limit.toString()) : 10;

    const project = await Project.findOne({projectID}).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const isAdmin = checkProjectAdminPermission(project, req.user);
      if (!isAdmin) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }


    const invitations = await ProjectInvitation.find({ projectID, accepted: false, expires: { $gt: new Date() } })
      .select("-token -_id -__v")
      .sort({ createdAt: -1 }) 
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "sender",
        select: "firstName lastName -_id", 
      }).
      lean();

      const totalInvitations = await ProjectInvitation.countDocuments({ projectID, accepted: false, expires: { $gt: new Date() } });

      return res.status(200).send({
        err: false,
        data: {
          invitations: invitations,
          total: totalInvitations,
          pagination: {
            page,
            limit,
          },
        },
      });
  }
  catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}


export async function deleteProjectInvitation(req: ZodReqWithUser<z.infer<typeof deleteProjectInvitationSchema>>, res: Response){
  try{
      const { inviteID } = req.params;

      if (!inviteID) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err1,
        });
      }
      
      const invitation = await ProjectInvitation.findOne({ inviteID });
      if (!invitation) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err69
        });
      }

      const { projectID } = invitation;
      const project = await Project.findOne({projectID}).lean();
      if (!project) {
        return res.status(404).send({
          err: true,
          errMsg: conductorErrors.err11,
        });
      }
      
      const isAdmin = checkProjectAdminPermission(project, req.user);
      if (!isAdmin) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }

      await ProjectInvitation.deleteOne({ inviteID});

      return res.status(200).send({
        err: false,
        deleted: true,
      });
    } catch (e) {
      debugError(e);
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    }
}

export async function updateProjectInvitation(req: ZodReqWithUser<z.infer<typeof updateProjectInvitationSchema>>, res: Response){
  try {
    const { inviteID } = req.params;
    const { role } = req.body;

    if (!inviteID || !role) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err1,
      });
    }

    const updatedInvitation = await ProjectInvitation.findOneAndUpdate(
      { inviteID },
      { role },
      { new: true, projection: "-_id -token -__v" } 
    );

    if (!updatedInvitation) {
      return res.status(404).json({
        err: true,
        errMsg: conductorErrors.err11
      });
    }

    return res.status(200).json({
      err: false,
      updatedInvitation,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

export async function acceptProjectInvitation(req: ZodReqWithUser<z.infer<typeof acceptProjectInvitationSchema>>, res: Response){
  try{
    
    const { inviteID } = req.params;
    const { token } = req.query;
    if (!inviteID || !token) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err1,
      });
    }

    const invitation = await ProjectInvitation.findOne({ inviteID, token });

    if (!invitation) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err69
      });
    }

    if (new Date() > new Date(invitation.expires)) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err69,
      });
    }

    if (invitation.accepted === true) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err66
      });
    }

    invitation.accepted = true;
    await invitation.save();

    const { projectID, email } = invitation;

    if (!projectID || !email) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err7,
      });
    }

    const result = await _addMemberToProjectInternal(projectID, user.uuid, req.user);
    return res.status(200).send({
      err: false,
      msg: "Invitation accepted and member added to project.",
      data: projectID
    });

  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}


export default {
  createProjectInvitation,
  getProjectInvitation,
  getAllInvitationsForProject,
  deleteProjectInvitation,
  updateProjectInvitation,
  acceptProjectInvitation
}
