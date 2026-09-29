import './Projects.css';
import 'react-circular-progressbar/dist/styles.css';

import { Breadcrumb, Button, Checkbox, Modal, Spinner, Tooltip } from '@libretexts/davis-react';
import { IconInfoCircle, IconPlus, IconRefresh } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import axios from 'axios';
import queryString from 'query-string';

import Messaging from '../Messaging';
import { isEmptyString } from '../util/HelperFunctions.js';
import {
  checkCanViewProjectDetails,
  checkProjectAdminPermission,
  checkProjectMemberPermission,
} from '../util/ProjectHelpers';
import useGlobalError from '../error/ErrorHooks';

const ProjectAccessibility = (props) => {
  const { handleGlobalError } = useGlobalError();
  const user = useSelector((state) => state.user);

  const [loadingData, setLoadingData] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [project, setProject] = useState({});
  const [reviewSections, setReviewSections] = useState([]);
  const [canViewDetails, setCanViewDetails] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addNameErr, setAddNameErr] = useState(false);

  const [showSyncTOCModal, setShowSyncTOCModal] = useState(false);
  const [syncTOCLoading, setSyncTOCLoading] = useState(false);

  useEffect(() => {
    document.title = 'LibreTexts Conductor | Projects | Project View | Accessibility';
    date.plugin(ordinal);
    date.plugin(day_of_week);
    getProject();
    if (localStorage.getItem('conductor_show_a11ydiscussion') === 'true') {
      setShowDiscussion(true);
    }
  }, []);

  useEffect(() => {
    const queryValues = queryString.parse(props.location.search);
  }, [props.location.search]);

  useEffect(() => {
    if (project.title) {
      document.title = `LibreTexts Conductor | Projects | ${project.title} | Accessibility`;
    }
  }, [project]);

  useEffect(() => {
    if (typeof user.uuid === 'string' && user.uuid !== '' && Object.keys(project).length > 0) {
      if (checkProjectAdminPermission(project, user) || checkProjectMemberPermission(project, user)) {
        setCanViewDetails(true);
      } else {
        setCanViewDetails(checkCanViewProjectDetails(project, user));
      }
    }
  }, [project, user]);

  useEffect(() => {
    if (canViewDetails) getReviewSections();
  }, [canViewDetails]);

  const getProject = () => {
    setLoadingData(true);
    axios.get('/project', { params: { projectID: props.match.params.id } })
      .then((res) => {
        if (!res.data.err) {
          if (res.data.project) setProject(res.data.project);
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingData(false);
      }).catch((err) => { handleGlobalError(err); setLoadingData(false); });
  };

  const getReviewSections = () => {
    setLoadingData(true);
    axios.get('/project/accessibility/sections', { params: { projectID: props.match.params.id } })
      .then((res) => {
        if (!res.data.err) {
          if (res.data.a11yReview) setReviewSections(res.data.a11yReview);
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingData(false);
      }).catch((err) => { handleGlobalError(err); setLoadingData(false); });
  };

  const addSection = () => {
    if (!isEmptyString(addName) && addName.length < 150) {
      setAddNameErr(false);
      setLoadingData(true);
      axios.post('/project/accessibility/section', {
        projectID: props.match.params.id,
        sectionTitle: addName,
      }).then((res) => {
        if (!res.data.err) {
          getReviewSections();
          closeAddModal();
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingData(false);
      }).catch((err) => { handleGlobalError(err); setLoadingData(false); });
      closeAddModal();
    } else {
      setAddNameErr(true);
    }
  };

  const updateSectionItem = (sectionID, itemName, newValue) => {
    axios.put('/project/accessibility/section/item', {
      projectID: props.match.params.id,
      sectionID,
      itemName,
      newResponse: newValue,
    }).then((res) => {
      if (!res.data.err) {
        setReviewSections(reviewSections.map((item) =>
          item._id === sectionID ? { ...item, [itemName]: newValue } : item
        ));
      } else {
        handleGlobalError(res.data.errMsg);
      }
    }).catch((err) => handleGlobalError(err));
  };

  const openAddModal = () => { setAddName(''); setAddNameErr(false); setShowAddModal(true); };
  const closeAddModal = () => { setShowAddModal(false); setAddName(''); setAddNameErr(false); };
  const handleChangeDiscussionVis = () => {
    setShowDiscussion(!showDiscussion);
    localStorage.setItem('conductor_show_a11ydiscussion', !showDiscussion);
  };
  const openSyncTOCModal = () => { setShowSyncTOCModal(true); setSyncTOCLoading(false); };
  const closeSyncTOCModal = () => { setShowSyncTOCModal(false); setSyncTOCLoading(false); };
  const syncTOC = (merge) => {
    setSyncTOCLoading(true);
    const data = { projectID: props.match.params.id, ...(merge === true && { merge: true }) };
    axios.put('/project/accessibility/importsections', data).then((res) => {
      if (!res.data.err) { closeSyncTOCModal(); getReviewSections(); }
      else { handleGlobalError(res.data.errMsg); setSyncTOCLoading(false); }
    }).catch((err) => { handleGlobalError(err); setSyncTOCLoading(false); });
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">
        Accessibility: <em>{project.title || 'Loading...'}</em>
      </h1>

      <div>
        <Breadcrumb>
          <Breadcrumb.Item><Link to="/projects">Projects</Link></Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link to={`/projects/${project.projectID}`}>{project.title || 'Loading...'}</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Accessibility</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      {loadingData ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Discussion */}
          {canViewDetails && showDiscussion && (
            <div>
              <div className="flex items-center justify-between border-b pb-1 mb-3">
                <h2 className="text-xl font-semibold">Accessibility Discussion</h2>
                <Button size="sm" variant="outline" onClick={handleChangeDiscussionVis}>Hide</Button>
              </div>
              <div className="border rounded-lg p-4">
                <Messaging projectID={props.match.params.id} user={user} kind="a11y" />
              </div>
            </div>
          )}
          {canViewDetails && !showDiscussion && (
            <div className="border rounded-lg p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Accessibility Discussion</h2>
              <Button size="sm" variant="outline" onClick={handleChangeDiscussionVis}>Show</Button>
            </div>
          )}
          {!canViewDetails && (
            <div>
              <h2 className="text-xl font-semibold border-b pb-1 mb-3">Accessibility Discussion</h2>
              <div className="border rounded-lg p-4 text-gray-500">
                <em>You don't have permission to view this project's Accessibility Discussion yet.</em>
              </div>
            </div>
          )}

          {/* Compliance Matrix */}
          {canViewDetails && (
            <div>
              <h2 className="text-xl font-semibold border-b pb-1 mb-3">Accessibility Compliance Review Matrix</h2>
              <div className="flex items-center justify-between mb-3">
                <p>
                  <strong>Accessibility Score:</strong>{' '}
                  <span className="project-yellow-score">N/A</span>
                </p>
                {(!isEmptyString(project.projectURL) && !isEmptyString(project.libreLibrary) && !isEmptyString(project.libreCoverID)) ? (
                  <Button variant="primary" icon={<IconRefresh size={14} />} onClick={openSyncTOCModal}>
                    Sync TOC from LibreTexts
                  </Button>
                ) : (
                  <Tooltip content="Save your project's libretexts.org URL in Edit Properties to use this feature.">
                    <Button variant="primary" icon={<IconRefresh size={14} />} disabled>
                      Sync TOC from LibreTexts
                    </Button>
                  </Tooltip>
                )}
              </div>
              <div className="access-table-outer">
                <div className="access-table-inner">
                  <table className="mt-1p" id="access-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} id="access-add-cell">
                          <Button variant="primary" icon={<IconPlus size={14} />} onClick={openAddModal} id="access-add-section-btn" />
                        </th>
                        <th colSpan={1} className="text-center">Navigation</th>
                        <th colSpan={3} className="text-center">Images</th>
                        <th colSpan={3} className="text-center">Links</th>
                        <th colSpan={3} className="text-center">Contrast</th>
                        <th colSpan={5} className="text-center">Text</th>
                        <th colSpan={2} className="text-center">Headings</th>
                        <th colSpan={2} className="text-center">Forms</th>
                        <th colSpan={3} className="text-center">Tables</th>
                        <th colSpan={2} className="text-center">Lists</th>
                        <th colSpan={2} className="text-center">Documents</th>
                        <th colSpan={4} className="text-center">Multimedia</th>
                        <th colSpan={1} className="text-center">DIV</th>
                        <th colSpan={1} className="text-center">Sensory Characteristics</th>
                        <th colSpan={1} className="text-center">Timing</th>
                        <th colSpan={1} className="text-center">Computer Code</th>
                      </tr>
                      <tr>
                        <th><span className="access-table-sectiondescription">Can you use the keyboard to access all content displayed?</span></th>
                        <th><span className="access-table-sectiondescription">Do all images have meaningful alt text?</span></th>
                        <th><span className="access-table-sectiondescription">For images not requiring alt text, is it marked as decorative?</span></th>
                        <th><span className="access-table-sectiondescription">Is all alt text under 150 characters? (Consider a caption instead)</span></th>
                        <th><span className="access-table-sectiondescription">Removed all empty links?</span></th>
                        <th><span className="access-table-sectiondescription">Removed all Suspicious Link Text?</span></th>
                        <th><span className="access-table-sectiondescription">Are URLs outside of LibreTexts labelled properly? (third party URL destination)</span></th>
                        <th><span className="access-table-sectiondescription">Is text contrast 4.5:1 for text 18pt and smaller?</span></th>
                        <th><span className="access-table-sectiondescription">Is text contrast 3:1 for text over 18pt?</span></th>
                        <th><span className="access-table-sectiondescription">Do graphical links/buttons have 3:1 contrast ratio?</span></th>
                        <th><span className="access-table-sectiondescription">Is all text larger than 10pt?</span></th>
                        <th><span className="access-table-sectiondescription">Alter text size? Keep line height at least 1.5 times the font size.</span></th>
                        <th><span className="access-table-sectiondescription">Alter text size? Spacing following paragraphs is 2x the font size.</span></th>
                        <th><span className="access-table-sectiondescription">Alter text size? Letter spacing is 0.12 times the font size.</span></th>
                        <th><span className="access-table-sectiondescription">Alter text size? Word spacing is 0.16 times the font size.</span></th>
                        <th><span className="access-table-sectiondescription">There are no empty headings</span></th>
                        <th><span className="access-table-sectiondescription">Heading Outline</span></th>
                        <th><span className="access-table-sectiondescription">Do form fields have a label?</span></th>
                        <th><span className="access-table-sectiondescription">Can you navigate questions and answered radio buttons?</span></th>
                        <th><span className="access-table-sectiondescription">Do tables have column and row headers?</span></th>
                        <th><span className="access-table-sectiondescription">Are the tables labeled?</span></th>
                        <th><span className="access-table-sectiondescription">No tables are embedded as images</span></th>
                        <th><span className="access-table-sectiondescription">Are ordered lists properly labeled?</span></th>
                        <th><span className="access-table-sectiondescription">Are unordered lists properly labeled?</span></th>
                        <th><span className="access-table-sectiondescription">Does document link make sense and followed up with (FILETYPE)?</span></th>
                        <th><span className="access-table-sectiondescription">Is the document accessible?</span></th>
                        <th><span className="access-table-sectiondescription">Does the video have captions?</span></th>
                        <th><span className="access-table-sectiondescription">Can you navigate the video player controls?</span></th>
                        <th><span className="access-table-sectiondescription">If no transcript, does the audio have a transcript?</span></th>
                        <th><span className="access-table-sectiondescription">Does the video have audio descriptions or a media alternative if necessary?</span></th>
                        <th><span className="access-table-sectiondescription">All DIV boxes are converted to SECTION LANDSCAPE</span></th>
                        <th><span className="access-table-sectiondescription">Instructions provided for interactive content do not rely solely on shape, color, size, visual location, orientation, or sound</span></th>
                        <th>
                          <span className="access-table-sectiondescription">
                            Time limits meet criteria
                            <Tooltip content="If time limits have been set, at least one must be true: ability to turn off, adjust, or extend; real-time exception; essential exception; or 20-hour exception.">
                              <IconInfoCircle size={13} className="inline-block ml-1 text-gray-400" />
                            </Tooltip>
                          </span>
                        </th>
                        <th><span className="access-table-sectiondescription">Inserting code for review? Ensure that characters and spaces are included as alt text for screenreaders.</span></th>
                      </tr>
                    </thead>
                    <tbody id="access-table-body">
                      {reviewSections.length > 0 ? reviewSections.map((item) => (
                        <tr key={item._id}>
                          <td>
                            {!isEmptyString(item.sectionURL) ? (
                              <a href={item.sectionURL} target="_blank" rel="noopener noreferrer"><strong>{item.sectionTitle}</strong></a>
                            ) : (
                              <strong>{item.sectionTitle}</strong>
                            )}
                          </td>
                          {[
                            ['navKeyboard'], ['imgAltText'], ['imgDecorative'], ['imgShortAlt'],
                            ['linkNoneEmpty'], ['linkSuspicious'], ['linkExtLabeled'],
                            ['contrastSmall'], ['contrastLarge'], ['contrastButtons'],
                            ['textSize'], ['textLineHeight'], ['textParSpacing'], ['textLetterSpacing'], ['textWordSpacing'],
                            ['headingNoneEmpty'], ['headingOutline'],
                            ['formFieldLabels'], ['formNavRadio'],
                            ['tableHeaders'], ['tableLabel'], ['tableNotImage'],
                            ['listOlLabel'], ['listUlLabel'],
                            ['docLinkFile'], ['docAccess'],
                            ['multiCaption'], ['multiNavControls'], ['multiAudioTrans'], ['multiAudioDescrip'],
                            ['divSection'], ['senseInstruction'], ['timingCriteria'], ['codeAltText'],
                          ].map(([field]) => (
                            <td key={field} className="access-table-cell text-center">
                              <Checkbox
                                checked={!!item[field]}
                                onChange={(checked) => updateSectionItem(item._id, field, checked)}
                              />
                            </td>
                          ))}
                        </tr>
                      )) : (
                        <tr>
                          <td></td>
                          <td colSpan={33}><em>No sections added yet.</em></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {!canViewDetails && (
            <div>
              <h2 className="text-xl font-semibold border-b pb-1 mb-3">Accessibility Compliance Review Matrix</h2>
              <div className="border rounded-lg p-4 text-gray-500">
                <em>You don't have permission to view this project's Accessibility Compliance Review Matrix yet.</em>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Section Modal */}
      <Modal open={showAddModal} onClose={(v) => !v && closeAddModal()}>
        <Modal.Header><Modal.Title>Add Section</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="flex flex-col gap-1">
            <label className="form-field-label" htmlFor="addSectionName">New Section Name</label>
            <input
              id="addSectionName"
              className={`border rounded px-3 py-2 text-sm ${addNameErr ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="New section name..."
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
            {addNameErr && <p className="text-red-500 text-xs">Please enter a valid section name (under 150 characters).</p>}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={closeAddModal}>Cancel</Button>
          <Button variant="primary" icon={<IconPlus size={14} />} onClick={addSection}>Add</Button>
        </Modal.Footer>
      </Modal>

      {/* Sync TOC Modal */}
      <Modal open={showSyncTOCModal} onClose={(v) => !v && closeSyncTOCModal()}>
        <Modal.Header><Modal.Title>Sync Table of Contents</Modal.Title></Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>Import Mode:</strong> Imports your LibreText's table of contents and{' '}
            <strong><em>overwrites</em></strong> all existing entries in the Accessibility Compliance Review Matrix.
          </p>
          <p className="mb-4">
            <strong>Import &amp; Merge Mode:</strong> Imports your LibreText's table of contents and attempts to merge
            existing entries with new entries in the TOC.{' '}
            <strong><em>Section/page names are case- and character-sensitive. Unmatchable names may be overwritten.</em></strong>
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<IconRefresh size={14} />}
              loading={syncTOCLoading}
              onClick={() => syncTOC(false)}
              className="flex-1"
            >
              Sync using Import Mode
            </Button>
            <Button
              variant="primary"
              icon={<IconRefresh size={14} />}
              loading={syncTOCLoading}
              onClick={() => syncTOC(true)}
              className="flex-1"
            >
              Sync using Import &amp; Merge Mode
            </Button>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={closeSyncTOCModal}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectAccessibility;
