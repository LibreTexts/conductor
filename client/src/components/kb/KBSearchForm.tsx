import { useState } from "react";
import { Form, FormProps } from "semantic-ui-react";

interface KBSearchFormProps extends FormProps { }

const KBSearchForm: React.FC<KBSearchFormProps> = ({
    ...rest
}) => {
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSearch() {
        if (!search) return;
        window.location.href = `/insight/search?query=${encodeURIComponent(search)}`;
    }

    return (
        <Form
            className="w-full flex justify-center"
            onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
            }}
            {...rest}
        >
            <Form.Input
                id="kb-search"
                icon="search"
                placeholder="Search Insight Articles..."
                className="w-3/4"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                loading={loading}
            />
        </Form>
    )
}

export default KBSearchForm;