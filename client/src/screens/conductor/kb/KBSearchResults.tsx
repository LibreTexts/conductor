import { useEffect, useState } from "react";
import useGlobalError from "../../../components/error/ErrorHooks";
import DefaultLayoutWNavTree from "../../../components/kb/DefaultLayoutWNavTree";
import KBFooter from "../../../components/kb/KBFooter";
import useQueryParam from "../../../utils/useQueryParam";
import axios from "axios";
import { KBSearchResult } from "../../../types";

const KBSearchResults = () => {
    const { handleGlobalError } = useGlobalError();
    const query = useQueryParam("query");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<KBSearchResult[]>([]);

    useEffect(() => {
        if (query) {
            handleSearch(query);
        }
    }, [query])

    async function handleSearch(query: string) {
        try {
            setLoading(true);
            const decoded = decodeURIComponent(query);
            const res = await axios.get('/kb/search', {
                params: {
                    query: decoded
                }
            })

            if (res.data.err) {
                throw new Error(res.data.err)
            }

            if (!res.data.pages || !Array.isArray(res.data.pages)) {
                throw new Error("Invalid response from server")
            }

            console.log(res.data.pages)
            setResults(res.data.pages);
        } catch (err) {
            handleGlobalError(err);
        } finally {
            setLoading(false);
        }
    }

    function goToPage(slug: string) {
        window.location.href = `/kb/${slug}`;
    }

    return (
        <DefaultLayoutWNavTree>
            <div className="flex flex-col" aria-busy={loading}>
                <h1 className="text-4xl font-semibold">
                    Search Results
                </h1>
                <div className="my-6">
                    {loading && (
                        <p>Loading...</p>
                    )}
                    {
                        !loading && results.length === 0 && (
                            <p>No results found.</p>
                        )
                    }
                    {!loading && results.length > 0 && results.map((result) => (
                        <div key={result.uuid} onClick={() => {
                            goToPage(result.slug);
                        }} className="w-full rounded-lg shadow-md hover:shadow-xl mb-4 border cursor-pointer">
                            <div className="p-4">
                                <p className="text-xl font-semibold overflow-clip">{result.title}</p>
                                <p className="overflow-clip">{result.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <KBFooter className="mt-8" />
        </DefaultLayoutWNavTree>
    );
};

export default KBSearchResults;