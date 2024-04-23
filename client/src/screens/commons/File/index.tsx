import {
  Breadcrumb,
  Segment,
} from 'semantic-ui-react';
import { Link, useParams } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { Stream } from '@cloudflare/stream-react';
import api from '../../../api';
import styles from './File.module.css';
import { ProjectFile } from '../../../types';
import useGlobalError from '../../../components/error/ErrorHooks';
import { isAssetTagKeyObject } from '../../../utils/typeHelpers';

type CommonsFileProps = {};

const CommonsFile: React.FC<CommonsFileProps> = () => {
  const { handleGlobalError } = useGlobalError();

  const [file, setFile] = useState<ProjectFile | null>(null);
  const { fileID, projectID } = useParams<{ fileID: string; projectID: string; }>();
  const [loading, setLoading] = useState(false);
  const [videoStreamURL, setVideoStreamURL] = useState<string | null>(null);

  async function getFile() {
    setLoading(true);
    try {
      const fileRes = await api.getProjectFile(projectID, fileID);
      if (!fileRes.data.file) {
        throw new Error('File not found');
      }
      setFile(fileRes.data.file);
      if (fileRes.data.videoStreamURL) {
        setVideoStreamURL(fileRes.data.videoStreamURL);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectID && fileID) {
      getFile();
    }
  }, []);

  return (
    <div className="commons-page-container">
      <Segment.Group raised>
        <Segment>
          <Breadcrumb>
            <Breadcrumb.Section as={Link} to="/catalog">
              <span>
                <span className="muted-text">You are on: </span>
                Catalog
              </span>
            </Breadcrumb.Section>
            <Breadcrumb.Divider icon="right chevron" />
            <Breadcrumb.Section active>{file?.name ?? 'Unknown'}</Breadcrumb.Section>
          </Breadcrumb>
        </Segment>
        <Segment loading={loading} className="pt-1p">
          <div className={styles.grid}>
            <div className={styles.videoMeta}>
              <h2 className={styles.videoTitle}>{file?.name ?? 'Unknown'}</h2>
              <ul className={styles.videoDetailList}>
                {file?.authors?.length && (
                  <li><strong>Author{file.authors.length > 1 ? 's' : ''}:</strong>{' '}
                  {file.authors.map((a) => `${a.firstName} ${a.lastName}`).join(', ')}</li>
                )}
                {file?.license?.name && (
                  <li><strong>License:</strong> {file.license.name}</li>
                )}
                {file?.tags?.length && (
                  <li>
                    <strong>Tags:</strong>{' '}
                    {file.tags.map((t) => `${isAssetTagKeyObject(t.key) ? t.key.title : t.key}: ${t.value?.toString()}`).join(', ')}
                  </li>
                )}
              </ul>
            </div>
            {videoStreamURL && (
              <div className={styles.videoContainer}>
                <Stream controls src={videoStreamURL} />
              </div>
            )}
          </div>
        </Segment>
      </Segment.Group>
    </div>
  );
};

export default CommonsFile;
