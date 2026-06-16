import './Projects.css';
import '../peerreview/PeerReview.css';
import 'react-circular-progressbar/dist/styles.css';

import {
  Alert,
  Breadcrumb,
  Button,
  Checkbox,
  Heading,
  Input,
  Modal,
  Select,
  Spinner,
} from '@libretexts/davis-react';
import {
  IconCopy,
  IconDeviceFloppy,
  IconEye,
  IconHeart,
  IconHeartOff,
  IconPlus,
  IconSend,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import axios from 'axios';

import useGlobalError from '../error/ErrorHooks';
import {
  checkCanViewProjectDetails,
  checkProjectAdminPermission,
  checkProjectMemberPermission,
  getPeerReviewAuthorText,
} from '../util/ProjectHelpers';

import Messaging from '../Messaging';
import PeerReview from '../peerreview/PeerReview.jsx';
import PeerReviewView from '../peerreview/PeerReviewView.jsx';

const reviewsSortOptions = [
  { value: 'author', label: 'Sort by Reviewer Name' },
  { value: 'date',   label: 'Sort by Date' },
];

const allowAnonOptions = [
  { value: 'true',  label: 'Yes' },
  { value: 'false', label: 'No' },
];

const ProjectPeerReview = (props) => {
  const { handleGlobalError } = useGlobalError();
  const user = useSelector((state) => state.user);

  const [loadingData, setLoadingData] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [reviewSort, setReviewSort] = useState('author');
  const [prShow, setPRShow] = useState(false);

  const [project, setProject] = useState({});
  const [peerReviews, setPeerReviews] = useState([]);
  const [displayReviews, setDisplayReviews] = useState([]);
  const [reviewAverage, setReviewAverage] = useState(0);
  const [prSettingsSaved, setPRSettingsSaved] = useState(false);

  const [canViewDetails, setCanViewDetails] = useState(false);
  const [userProjectMember, setUserProjectMember] = useState(false);

  const [prViewShow, setPRViewShow] = useState(false);
  const [prViewData, setPRViewData] = useState({});

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsAllowAnon, setSettingsAllowAnon] = useState('true');
  const [settingsPreferred, setSettingsPreferred] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsRubrics, setSettingsRubrics] = useState([]);
  const [settingsRubricsLoading, setSettingsRubricsLoading] = useState(false);
  const [settingsShowPreview, setSettingsShowPreview] = useState(false);
  const [settingsPreviewID, setSettingsPreviewID] = useState('');
  const [settingsUnsaved, setSettingsUnsaved] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteIncludeURL, setInviteIncludeURL] = useState(true);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteEmailErr, setInviteEmailErr] = useState(false);

  const [showDelModal, setShowDelModal] = useState(false);
  const [delReviewID, setDelReviewID] = useState('');
  const [delAuthor, setDelAuthor] = useState('');
  const [delLoading, setDelLoading] = useState(false);

  const getProject = useCallback(() => {
    if (typeof props.match.params.id === 'string' && props.match.params.id.length > 0) {
      setLoadingData(true);
      axios.get('/project', { params: { projectID: props.match.params.id } })
        .then((res) => {
          if (!res.data.err) {
            if (res.data.project) setProject(res.data.project);
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setLoadingData(false);
        })
        .catch((err) => { handleGlobalError(err); setLoadingData(false); });
    }
  }, [props.match, handleGlobalError]);

  const getReviews = useCallback(() => {
    setLoadingData(true);
    axios.get('/peerreviews', { params: { projectID: props.match.params.id } })
      .then((res) => {
        if (!res.data.err) {
          if (Array.isArray(res.data.reviews)) setPeerReviews(res.data.reviews);
          if (typeof res.data.averageRating === 'number') setReviewAverage(res.data.averageRating);
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingData(false);
      })
      .catch((err) => { setLoadingData(false); handleGlobalError(err); });
  }, [props.match, handleGlobalError]);

  useEffect(() => {
    document.title = 'LibreTexts Conductor | Projects | Project View | Peer Review';
    date.plugin(ordinal);
    date.plugin(day_of_week);
    getProject();
    if (localStorage.getItem('conductor_show_peerdiscussion') === 'true') {
      setShowDiscussion(true);
    }
  }, [getProject]);

  useEffect(() => {
    if (canViewDetails) getReviews();
  }, [canViewDetails, getReviews]);

  useEffect(() => {
    if (project.title) {
      document.title = `LibreTexts Conductor | Projects | ${project.title} | Peer Review`;
    }
  }, [project]);

  useEffect(() => {
    if (typeof user.uuid === 'string' && user.uuid !== '' && Object.keys(project).length > 0) {
      if (checkProjectAdminPermission(project, user) || checkProjectMemberPermission(project, user)) {
        setUserProjectMember(true);
        setCanViewDetails(true);
      } else if (project.visibility === 'public') {
        setCanViewDetails(true);
      } else {
        setCanViewDetails(checkCanViewProjectDetails(project, user));
      }
    }
  }, [project, user]);

  useEffect(() => {
    if (Array.isArray(peerReviews) && reviewSort.length > 0) {
      const sorted = [...peerReviews].sort((a, b) => {
        let aKey = null, bKey = null;
        if (reviewSort === 'author' && typeof a.author === 'string' && typeof b.author === 'string') {
          aKey = a.author.toLowerCase().replace(/[^A-Za-z]+/g, '');
          bKey = b.author.toLowerCase().replace(/[^A-Za-z]+/g, '');
        } else {
          aKey = new Date(a.createdAt);
          bKey = new Date(b.createdAt);
        }
        if (aKey < bKey) return -1;
        if (aKey > bKey) return 1;
        return 0;
      });
      setDisplayReviews(sorted);
    }
  }, [peerReviews, reviewSort]);

  const handleChangeDiscussionVis = () => {
    setShowDiscussion(!showDiscussion);
    localStorage.setItem('conductor_show_peerdiscussion', !showDiscussion);
  };

  const openReviewViewModal = (peerReview) => {
    if (typeof peerReview === 'object') {
      setPRViewData(peerReview);
      setPRViewShow(true);
    }
  };

  const handleCloseReviewView = () => { setPRViewShow(false); setPRViewData({}); };
  const handleClosePeerReview = () => { setPRShow(false); getReviews(); };

  const handleOpenSettingsModal = () => {
    if (project.hasOwnProperty('allowAnonPR')) setSettingsAllowAnon(project.allowAnonPR ? 'true' : 'false');
    if (project.hasOwnProperty('preferredPRRubric')) setSettingsPreferred(project.preferredPRRubric);
    setShowSettingsModal(true);
    setSettingsLoading(false);
    setSettingsUnsaved(false);
    setSettingsRubricsLoading(true);
    axios.get('/peerreview/rubrics').then((res) => {
      if (!res.data.err) {
        if (Array.isArray(res.data.rubrics)) setSettingsRubrics(res.data.rubrics);
      } else {
        handleGlobalError(res.data.errMsg);
      }
      setSettingsRubricsLoading(false);
    }).catch((err) => { setSettingsRubricsLoading(false); handleGlobalError(err); });
  };

  const handleCloseSettingsModal = () => {
    setShowSettingsModal(false);
    setSettingsAllowAnon('true');
    setSettingsPreferred('');
    setSettingsLoading(false);
    setSettingsUnsaved(false);
    setSettingsRubrics([]);
    setSettingsRubricsLoading(false);
  };

  const handleOpenRubricPreviewModal = (rubricID) => {
    if (typeof rubricID === 'string' && rubricID.length > 0) {
      setSettingsPreviewID(rubricID);
      setShowSettingsModal(false);
      setSettingsShowPreview(true);
    }
  };

  const handleCloseRubricPreviewModal = () => {
    setSettingsShowPreview(false);
    setSettingsPreviewID('');
    setShowSettingsModal(true);
  };

  const savePeerReviewSettings = () => {
    const updateObj = { projectID: props.match.params.id };
    const anonVal = settingsAllowAnon === 'true';
    if ((project.allowAnonPR !== anonVal) || !project.hasOwnProperty('allowAnonPR')) {
      updateObj.allowAnonPR = anonVal;
    }
    if ((project.preferredPRRubric !== settingsPreferred) || !project.hasOwnProperty('preferredPRRubric')) {
      updateObj.preferredPRRubric = settingsPreferred;
    }
    if (Object.keys(updateObj).length > 1) {
      setSettingsLoading(true);
      axios.put('/project', updateObj).then((res) => {
        if (!res.data.err) {
          setPRSettingsSaved(true);
          handleCloseSettingsModal();
          getProject();
        } else {
          setSettingsLoading(false);
          handleGlobalError(res.data.errMsg);
        }
      }).catch((err) => { setSettingsLoading(false); handleGlobalError(err); });
    } else {
      handleCloseSettingsModal();
    }
  };

  const handleSendInvite = () => {
    setInviteEmailErr(false);
    if (inviteEmail.length > 0 && inviteEmail.length < 1000) {
      setInviteSending(true);
      axios.post('/peerreview/invite', {
        projectID: props.match.params.id,
        inviteEmail,
        sendProjectURL: inviteIncludeURL,
      }).then((res) => {
        if (!res.data.err) { setInviteSent(true); setInviteEmail(''); }
        else handleGlobalError(res.data.errMsg);
        setInviteSending(false);
      }).catch((err) => { setInviteSending(false); handleGlobalError(err); });
    } else {
      setInviteEmailErr(true);
    }
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteIncludeURL(true);
    setInviteEmailErr(false);
    setInviteCopied(false);
    setInviteSending(false);
    setInviteSent(false);
  };

  const openDeleteModal = (reviewID, reviewAuthor) => {
    if (typeof reviewID === 'string' && typeof reviewAuthor === 'string' && reviewID.length > 0) {
      setDelReviewID(reviewID);
      setDelAuthor(reviewAuthor);
      setDelLoading(false);
      setShowDelModal(true);
    }
  };

  const closeDeleteModal = () => {
    setShowDelModal(false);
    setDelLoading(false);
    setDelReviewID('');
    setDelAuthor('');
  };

  const submitDeleteReview = () => {
    if (delReviewID.length > 0) {
      setDelLoading(true);
      axios.delete('/peerreview', { data: { peerReviewID: delReviewID } }).then((res) => {
        if (!res.data.err) { closeDeleteModal(); getReviews(); }
        else { setDelLoading(false); handleGlobalError(res.data.errMsg); }
      }).catch((err) => { setDelLoading(false); handleGlobalError(err); });
    }
  };

  const openAccessPR = project.visibility === 'public' && (project.allowAnonPR === true || !project.hasOwnProperty('allowAnonPR'));

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Page Header */}
      <h1 className="text-2xl font-bold">
        Peer Review: <em>{project.title || 'Loading...'}</em>
      </h1>

      <div>
        <Breadcrumb>
          <Breadcrumb.Item><Link to="/projects">Projects</Link></Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link to={`/projects/${project.projectID}`}>{project.title || 'Loading...'}</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Peer Review</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <div className="flex flex-col gap-6">
          {/* Peer Reviews Section */}
          {canViewDetails ? (
            <div>
              <h2 className="text-xl font-semibold border-b pb-1 mb-3">Peer Reviews</h2>
              {prSettingsSaved && (
                <Alert variant="success" message="Peer Review Settings updated!" className="mb-3" />
              )}
              <div className="border rounded-lg shadow-sm mb-4">
                {/* Controls bar */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <Select
                      name="reviewSort"
                      label=""
                      placeholder="Sort by..."
                      options={reviewsSortOptions}
                      value={reviewSort}
                      onChange={(e) => setReviewSort(e.target.value)}
                      className="w-56"
                    />
                    <div className="flex">
                      {userProjectMember ? (
                        <Button
                          icon={<IconSend size={15} />}
                          onClick={() => setShowInviteModal(true)}
                          variant="primary"
                          className="!rounded-r-none !border-r-0"
                        >
                          Invite Reviewer
                        </Button>
                      ) : (
                        <Button
                          icon={<IconSend size={15} />}
                          disabled
                          title="Project must have Public visibility and Peer Reviews from Non-Conductor Users allowed."
                          className="!rounded-r-none !border-r-0"
                        >
                          Invite Reviewer
                        </Button>
                      )}
                      {userProjectMember && (
                        <Button
                          icon={<IconSettings size={15} />}
                          onClick={handleOpenSettingsModal}
                          variant="primary"
                          className="!rounded-none"
                        >
                          Peer Review Settings
                        </Button>
                      )}
                      {(userProjectMember || openAccessPR) && (
                        <Button
                          icon={<IconPlus size={15} />}
                          onClick={() => setPRShow(true)}
                          variant="primary"
                          className="!rounded-l-none"
                        >
                          New Review
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-around mt-3 text-sm">
                    <p><strong>Reviews:</strong> {displayReviews.length}</p>
                    <p>
                      <strong>Average Rating:</strong>{' '}
                      {typeof project.rating === 'number' && project.rating > 0
                        ? <span>{reviewAverage}/5</span>
                        : <span className="text-gray-400">N/A</span>
                      }
                    </p>
                  </div>
                </div>

                {/* Review list */}
                <div className="p-4 relative min-h-[5rem]">
                  {loadingData && (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  )}
                  {!loadingData && displayReviews.length > 0 && (
                    <ul className="divide-y">
                      {displayReviews.map((item) => {
                        const itemDate = new Date(item.createdAt);
                        item.dateTime = date.format(itemDate, 'MMM DDD, YYYY h:mm A');
                        return (
                          <li key={item.peerReviewID} className="py-3 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-semibold">{item.author || 'Unknown Reviewer'}</span>
                              <span className="text-sm text-gray-500">
                                <em>{getPeerReviewAuthorText(item.authorType)}</em>
                                {' • '}
                                {item.dateTime}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {userProjectMember && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  icon={<IconTrash size={15} />}
                                  title="Delete Review"
                                  onClick={() => openDeleteModal(item.peerReviewID, item.author)}
                                />
                              )}
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<IconEye size={15} />}
                                title="View Review"
                                onClick={() => openReviewViewModal(item)}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {!loadingData && displayReviews.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No Peer Reviews yet!</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold border-b pb-1 mb-3">Peer Reviews</h2>
              <div className="border rounded-lg p-4 text-gray-500">
                <em>You don't have permission to view this project's Peer Reviews yet.</em>
              </div>
            </div>
          )}

          {/* Discussion Section */}
          {userProjectMember && showDiscussion && (
            <div>
              <div className="flex items-center justify-between border-b pb-1 mb-3">
                <h2 className="text-xl font-semibold">Peer Review Discussion</h2>
                <Button size="sm" variant="outline" onClick={handleChangeDiscussionVis}>Hide</Button>
              </div>
              <div className="border rounded-lg p-4">
                <Messaging projectID={props.match.params.id} user={user} kind="peerreview" />
              </div>
            </div>
          )}
          {canViewDetails && !showDiscussion && (
            <div className="border rounded-lg p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Peer Review Discussion</h2>
              <Button size="sm" variant="outline" onClick={handleChangeDiscussionVis}>Show</Button>
            </div>
          )}
          {!canViewDetails && (
            <div>
              <h2 className="text-xl font-semibold border-b pb-1 mb-3">Peer Review Discussion</h2>
              <div className="border rounded-lg p-4 text-gray-500">
                <em>You don't have permission to view this project's Peer Review Discussion yet.</em>
              </div>
            </div>
          )}
      </div>

      {/* Peer Review Settings Modal */}
      <Modal open={showSettingsModal} onClose={(v) => !v && handleCloseSettingsModal()}>
        <Modal.Header>
          <Modal.Title>Peer Review Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-10rem)] space-y-4">
          {settingsUnsaved && (
            <Alert variant="warning" message="You have unsaved changes!" />
          )}
          <p className="text-sm font-semibold uppercase text-gray-500">Privacy Settings</p>
          <Select
            name="settingsAllowAnon"
            label="Allow Peer Reviews from Non-Conductor Users"
            placeholder="Select..."
            options={allowAnonOptions}
            value={settingsAllowAnon}
            onChange={(e) => {
              setSettingsAllowAnon(e.target.value);
              const anonVal = e.target.value === 'true';
              if (project.allowAnonPR !== anonVal || !project.hasOwnProperty('allowAnonPR')) {
                setSettingsUnsaved(true);
              }
            }}
          />
          <p className="text-xs text-gray-500">
            Only applies if Project has 'Public' visibility. <em>Defaults to Yes.</em>
          </p>

          <p className="text-sm font-semibold uppercase text-gray-500 mt-4">Preferred Rubric</p>
          <p className="text-sm text-gray-500">
            <em>Select a Peer Review Rubric below to choose the rubric shown to new reviewers. Otherwise, your Campus' or LibreTexts' default rubric will be used.</em>
          </p>

          {settingsRubricsLoading && (
            <div className="flex justify-center py-4"><Spinner /></div>
          )}
          {!settingsRubricsLoading && settingsRubrics.length === 0 && (
            <p className="text-center text-gray-400 py-4">No Rubrics available right now.</p>
          )}
          {!settingsRubricsLoading && settingsRubrics.length > 0 && (
            <ul className="divide-y">
              {settingsRubrics.map((item) => (
                <li key={item.rubricID} className="py-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-semibold">{item.rubricTitle || 'Unknown Rubric'}</span>
                    <span className="text-sm text-gray-500">
                      {item.organization?.shortName || 'Unknown Organization'}
                      {item.isOrgDefault && <em> (Campus Default)</em>}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {settingsPreferred !== item.rubricID ? (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<IconHeartOff size={14} />}
                        onClick={() => {
                          setSettingsPreferred(item.rubricID);
                          if (item.rubricID !== project.preferredPRRubric) setSettingsUnsaved(true);
                        }}
                      >
                        Set as Preferred
                      </Button>
                    ) : (
                      <Button size="sm" disabled icon={<IconHeart size={14} className="text-red-500" />}>
                        Preferred Rubric
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<IconEye size={14} />}
                      onClick={() => handleOpenRubricPreviewModal(item.rubricID)}
                    >
                      Preview
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={handleCloseSettingsModal}>Cancel</Button>
          <Button
            variant="primary"
            loading={settingsLoading}
            icon={<IconDeviceFloppy size={15} />}
            onClick={savePeerReviewSettings}
          >
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Invite Reviewer Modal */}
      <Modal open={showInviteModal} onClose={(v) => !v && closeInviteModal()}>
        <Modal.Header>
          <Modal.Title>Invite Reviewer</Modal.Title>
        </Modal.Header>
        <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-10rem)] space-y-4">
          <p>You can send an invite to a reviewer without a Conductor account using the form below. Otherwise, we recommend adding reviewers to this Project as <em>Auditors</em>.</p>
          {inviteSent && (
            <Alert variant="success" message="Invitation sent!" />
          )}
          {typeof project.projectURL === 'string' && project.projectURL.length > 0 && (
            <Checkbox
              name="inviteIncludeURL"
              label="Include this Project's Project URL (recommended)"
              checked={inviteIncludeURL}
              onChange={(checked) => setInviteIncludeURL(checked)}
            />
          )}
          <div className="flex gap-2">
            <Input
              name="inviteEmail"
              label="Email address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter an email..."
              error={inviteEmailErr}
              errorMessage="Please enter a valid email address."
              className="flex-1"
            />
            <div className="flex items-end">
              <Button
                variant="primary"
                icon={<IconSend size={15} />}
                loading={inviteSending}
                onClick={handleSendInvite}
              >
                Send Invite
              </Button>
            </div>
          </div>

          <div className="flex items-center my-2 gap-3">
            <hr className="flex-1" />
            <span className="text-gray-500 text-sm">Or</span>
            <hr className="flex-1" />
          </div>

          <p>You can also share this link with others to allow them to review with or without a Conductor account!</p>
          {inviteCopied && <Alert variant="success" message="Copied to clipboard!" />}
          <div className="flex gap-2">
            <Input
              name="inviteLink"
              label="Peer Review URL"
              type="url"
              value={`commons.libretexts.org/peerreview/${props.match.params.id}`}
              readOnly
              className="flex-1"
            />
            <div className="flex items-end">
              <Button
                variant="primary"
                icon={<IconCopy size={15} />}
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(`commons.libretexts.org/peerreview/${props.match.params.id}`);
                    setInviteCopied(true);
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Copy Link
              </Button>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={closeInviteModal}>Done</Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Review Modal */}
      <Modal open={showDelModal} onClose={(v) => !v && closeDeleteModal()}>
        <Modal.Header>
          <Modal.Title>Delete Peer Review</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete this Peer Review by {delAuthor}{' '}
            <span className="text-gray-400">(ID: {delReviewID})</span>?{' '}
            <strong>This cannot be undone.</strong>
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={closeDeleteModal}>Cancel</Button>
          <Button
            variant="destructive"
            loading={delLoading}
            icon={<IconTrash size={15} />}
            onClick={submitDeleteReview}
          >
            Delete Review
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Rubric Preview */}
      <PeerReview
        open={settingsShowPreview}
        onClose={handleCloseRubricPreviewModal}
        rubricID={settingsPreviewID}
        demoView={true}
      />

      {/* New Peer Review */}
      <PeerReview
        open={prShow}
        onClose={handleClosePeerReview}
        projectID={props.match.params.id}
      />

      <PeerReviewView
        open={prViewShow}
        onClose={handleCloseReviewView}
        peerReviewData={prViewData}
        publicView={false}
      />
    </div>
  );
};

export default ProjectPeerReview;
