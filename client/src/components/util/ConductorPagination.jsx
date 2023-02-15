//
// LibreTexts Conductor
// ConductorPagination.jsx
// A reusable, A11Y-forward extension of the Semantic UI
// pagination tool.
//


import {
    Pagination,
} from 'semantic-ui-react';

const ConductorPagination = ({activePage, totalPages, onPageChange, ...props}) => {
    return (
        <Pagination
            activePage={activePage}
            totalPages={totalPages}
            firstItem={null}
            lastItem={null}
            onPageChange={(_e, data) => { onPageChange(data.activePage) }}
            prevItem={{
                'aria-label': 'Previous page',
                content: '⟨',
            }}
            nextItem={{
                'aria-label': 'Next page',
                content: '⟩',
            }}
            {...props}
        />
    );
};

export default ConductorPagination;
