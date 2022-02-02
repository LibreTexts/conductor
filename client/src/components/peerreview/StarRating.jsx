import './PeerReview.css';
import '@fortawesome/fontawesome-free/css/all.css';

import React, { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';


const StarRating = ({
    value,
    onChange,
    displayMode,
    fieldLabel,
    fieldRequired,
    singleRating
}) => {

    /* Star values to render */
    const stars = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

    /**
     * Ensures necessary props have been passed on initialization.
     */
    useEffect(() => {
        if (typeof (onChange) !== 'function' && !displayMode) {
            console.error("StarRating: Invalid or missing onChange handler.");
        }
    }, [onChange, displayMode]);


    /**
     * Performs internal type casting before triggering the provided value change
     * handler (if applicable).
     * @param {Event} e - The DOM click event.
     */
    const handleChange = useCallback((e) => {
        if (!displayMode && typeof (onChange) === 'function') {
            let newValue = parseFloat(e.target.value);
            onChange(newValue);
        }
    }, [displayMode, onChange]);


    /**
     * Renders filled stars (according to provided value) in Display Mode.
     * @returns {JSX.Element} The rendered, filled stars (if applicable).
     */
    const FullStars = () => {
        if (value !== 'undefined') {
            let valParts = value.toString().split('.');
            let fullStars = parseInt(valParts[0]);
            if (!isNaN(fullStars) && Number.isInteger(fullStars)) {
                return [...Array(fullStars).keys()].map((item) => {
                    return (
                        <span key={`display-star-${item}`} className='star-rating-display-child star-rating-display-star'>
                            <i className="fas fa-star"></i>
                        </span>
                    )
                });
            }
        }
        return null;
    };


    /**
     * Renders half-filled stars and empty stars (according to provided value) in Display Mode.
     * @returns {JSX.Element} The rendered, half-filled or empty stars (if applicable).
     */
    const RemainingStars = () => {
        if (typeof (value) === 'number') {
            let remainder = 5 - value;
            if (remainder > 0) {
                let remParts = remainder.toString().split('.');
                let hasHalf = remParts.length === 2 && !isNaN(parseInt(remParts[1]));
                let remFull = parseInt(remParts[0]);
                let hasFull = !isNaN(remFull) && Number.isInteger(remFull);
                if (hasHalf || hasFull) {
                    return (
                        <>
                            {hasHalf && (
                                <span className='star-rating-display-child star-rating-display-half-full'>
                                    <i className="fas fa-star-half star-rating-display-half"></i>
                                    <i className="far fa-star-half fa-flip-horizontal star-rating-display-half-empty"></i>
                                </span>
                            )}
                            {hasFull && (
                                [...Array(remFull).keys()].map((item) => {
                                    return (
                                        <span
                                            key={`display-emptystar-${item}`}
                                            className='star-rating-display-child star-rating-display-empty'
                                        >
                                            <i className="far fa-star"></i>
                                        </span>
                                    )
                                })
                            )}
                        </>
                    )
                }
            }
        }
        return null;
    };


    if (!displayMode) {
        return (
            <fieldset
                className='star-rating'
                tabIndex={0}
                aria-labelledby={fieldLabel}
                aria-required={fieldRequired ? 'true' : 'false'}
            >
                {stars.map((star, idx) => {
                    return (
                        <React.Fragment key={idx}>
                            <input
                                type="radio"
                                id={`form-star-${idx}`}
                                name="starrating"
                                value={star}
                                checked={value === star}
                                onChange={handleChange}
                                title={`${star} stars`}
                                required={fieldRequired}
                            />
                            <label
                                htmlFor={`form-star-${idx}`}
                                title={`${star} stars`}
                                tabIndex={0}
                                className={!Number.isInteger(star) ? 'half' : ''}
                            > </label>
                        </React.Fragment>
                    )
                })}
            </fieldset>
        )
    } else {
        return (
            <div className='flex-row-div'>
                <div className='left-flex'>
                    <FullStars />
                    <RemainingStars />
                </div>
                <div className='right-flex'>
                    <span className='star-rating-display-text'>{value}/5 {!singleRating && 'avg.'}</span>
                </div>
            </div>
        )
    }

};

StarRating.defaultProps = {
    value: 0,
    onChange: null,
    displayMode: false,
    fieldLabel: '',
    fieldRequired: false,
    singleRating: false
};

StarRating.propTypes = {
    value: PropTypes.number.isRequired,
    onChange: PropTypes.func,
    displayMode: PropTypes.bool,
    fieldLabel: PropTypes.string,
    fieldRequired: PropTypes.bool,
    singleRating: PropTypes.bool
};

export default StarRating;
