import './PeerReview.css';

import {
    Image,
    Header,
    Loader
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';

import PeerReview from './PeerReview.jsx';

import useGlobalError from '../error/ErrorHooks';

const PeerReviewPage = (props) => {

    /* Global State and Error Handling */
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    /* UI and Form State */
    const [loadedForm, setLoadedForm] = useState(false);
    const [prShow, setPRShow] = useState(false);


    /**
     * Sets page title and checks that the specified Project allows Peer Reviews
     * from non-team members before opening the Peer Review Modal.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Peer Review";
        setLoadedForm(false);
        axios.get('/peerreview/access', {
            params: {
                projectID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err && res.data.access === true) {
                setPRShow(true);
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedForm(true);
        }).catch((err) => {
            setLoadedForm(true);
            handleGlobalError(err);
        });
    }, [props.match, setLoadedForm, setPRShow, handleGlobalError]);


    /**
     * Closes the Peer Review Modal and, if user is authenticated,
     * redirects them to Home.
     */
    const handlePeerReviewClose = () => {
        setPRShow(false);
        if (user.isAuthenticated) {
            props.history.push('/home');
        }
    };


    return (
        <div id="peerreview-page-container">
            <div id='peerreview-page-inner'>
                <Image
                    id='peerreview-page-logo'
                    src="/libretexts_logo.png"
                    alt='LibreTexts logo'
                    className='cursor-pointer'
                    onClick={() => {
                        window.location.assign("https://libretexts.org");
                        return false;
                    }}
                />
                <div className='text-center'>
                    <Header as='h1'>Peer Review</Header>
                    <Loader active={!loadedForm} inline='centered' />
                    {(user.isAuthenticated) ? (
                        <Link to='/home'>Back to Home</Link>
                    ) : (
                        <>
                            <a
                                href='https://libretexts.org'
                                rel='noopener noreferrer'
                            >
                                Main Site
                            </a>
                            <span className='ml-2p mr-2p'> / </span>
                            <Link to='/'>LibreCommons</Link>
                        </>
                    )}
                </div>
            </div>
            <PeerReview
                open={prShow}
                onClose={handlePeerReviewClose}
                projectID={props.match.params.id}
            />
        </div>
    )

};

export default PeerReviewPage;