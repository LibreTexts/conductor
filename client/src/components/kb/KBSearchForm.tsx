import { useState } from "react";
import { Input } from "@libretexts/davis-react";
import { IconSearch } from "@tabler/icons-react";

const KBSearchForm: React.FC = () => {
    const [search, setSearch] = useState("");

    async function handleSearch() {
        if (!search) return;
        window.location.href = `/insight/search?query=${encodeURIComponent(search)}`;
    }

    return (
        <form
            className="w-full flex justify-center"
            onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
            }}
        >
            <Input
                name="kb-search"
                label="Search Insight Articles"
                labelClassName="sr-only"
                placeholder="Search Insight Articles..."
                className="w-3/4"
                inputClassName="bg-white placeholder-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                rightIcon={<IconSearch size={18} aria-hidden="true" />}
            />
        </form>
    );
};

export default KBSearchForm;