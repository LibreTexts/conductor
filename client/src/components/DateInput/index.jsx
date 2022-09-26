import React, { memo } from 'react';
import PropTypes from 'prop-types';
import date from 'date-and-time';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import { DateUtils } from 'react-day-picker';
import './DateInput.css';

/**
 * A customizable date input.
 */
const DateInput = ({
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

DateInput.propTypes = {
    value: PropTypes.oneOfType([
        PropTypes.instanceOf(Date),
        PropTypes.string,
    ]),
    onChange: PropTypes.func,
    label: PropTypes.string,
    inlineLabel: PropTypes.bool,
    className: PropTypes.string,
};

DateInput.defaultProps = {
    value: '',
    onChange: () => {},
    label: null,
    inlineLabel: false,
    className: ''
};

export default memo(DateInput);
