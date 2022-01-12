//
// LibreTexts Conductor
// ConductorDateInput/index.js
// A reusable, customizable date input for use in
// the Conductor UI.
//

import './ConductorDateInput.css';

import DayPickerInput from 'react-day-picker/DayPickerInput';
import { DateUtils } from 'react-day-picker';
import React, { useEffect, useState, memo } from 'react';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';

import { isEmptyString } from '../HelperFunctions.js';

import useGlobalError from '../../error/ErrorHooks.js';

const ConductorDateInput = ({
    value,
    onChange,
    label,
    inlineLabel,
    className
}) => {

    const parseDate = (str, format) => {
        const parsed = date.parse(str, format);
        if (DateUtils.isDate(parsed)) return parsed;
        return undefined;
    };

    const formatDate = (inDate, format) => {
        return date.format(inDate, format);
    };

    return (
        <div className={`conductor-date-input ui form ${inlineLabel && 'inline'} ${className}`}>
            {(label !== null) &&
                <label className={`cdi-label ${inlineLabel && 'inline'}`}>{label}</label>
            }
            <DayPickerInput
                onDayChange={(day) => onChange(day)}
                value={value}
                format='MM-DD-YYYY'
                parseDate={parseDate}
                formatDate={formatDate}
                placeholder={`${formatDate(new Date(), 'MM-DD-YYYY')}`}
            />
        </div>
    )
};

ConductorDateInput.defaultProps = {
    value: '',
    onChange: () => {},
    label: null,
    inlineLabel: false,
    className: ''
};

export default memo(ConductorDateInput);
