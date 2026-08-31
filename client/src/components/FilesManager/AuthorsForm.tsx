import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Dropdown, Form } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import useDebounce from "../../hooks/useDebounce";
import api from "../../api";
import { ProjectFileAuthor } from "../../types/Project";

interface AuthorsFormProps {
  mode: "project-default" | "file";
  currentPrimaryAuthor?: ProjectFileAuthor;
}

type AuthorsFormRef = {
  getAuthors: () => {
    primaryAuthor: ProjectFileAuthor | null;
  };
};

const AuthorsForm = forwardRef(
  (props: AuthorsFormProps, ref: React.ForwardedRef<AuthorsFormRef>) => {
    const { mode, currentPrimaryAuthor } = props;

    const { handleGlobalError } = useGlobalError();
    const { debounce } = useDebounce();

    const [authorOptions, setAuthorOptions] = useState<ProjectFileAuthor[]>([]);
    const [loadingAuthors, setLoadingAuthors] = useState(false);

    const [selectedPrimary, setSelectedPrimary] =
      useState<ProjectFileAuthor | null>(currentPrimaryAuthor ?? null);

    useImperativeHandle(ref, () => ({
      getAuthors: () => ({
        primaryAuthor: selectedPrimary,
      }),
    }));

    useEffect(() => {
      loadAuthorOptions();
    }, []);

    // We need to update the selected author when the current author changes
    // since that data may not be available when the component is first rendered
    useEffect(() => {
      setSelectedPrimary(currentPrimaryAuthor ?? null);
      if (currentPrimaryAuthor) {
        setAuthorOptions((prev) => {
          return noDuplicateAuthors([...prev, currentPrimaryAuthor]);
        });
      }
    }, [currentPrimaryAuthor]);

    function noDuplicateAuthors(authors: ProjectFileAuthor[]) {
      return authors.filter(
        (a, i, self) => self.findIndex((b) => b._id === a._id) === i
      );
    }

    async function loadAuthorOptions(searchQuery?: string) {
      try {
        setLoadingAuthors(true);
        const res = await api.getAuthors({ query: searchQuery });
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }
        if (!res.data.items || !Array.isArray(res.data.items)) {
          throw new Error("Failed to load author options");
        }

        const opts = [
          ...res.data.items,
          ...(selectedPrimary ? [selectedPrimary] : []),
        ];
        setAuthorOptions(opts);
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoadingAuthors(false);
      }
    }

    const getAuthorsDebounced = debounce(
      (searchQuery?: string) => loadAuthorOptions(searchQuery),
      200
    );

    const primaryAuthorOpts = useMemo(() => {
      const opts = authorOptions.map((a) => ({
        key: crypto.randomUUID(),
        value: a._id ?? "",
        text: a.name ?? "Unknown",
      }));

      opts.unshift({
        key: crypto.randomUUID(),
        value: "",
        text: "Clear...",
      });

      return opts;
    }, [authorOptions]);

    return (
      <div className="mt-4">
        <label className="form-field-label" htmlFor="primaryAuthorSelect">
          {mode === "project-default" ? "Default " : ""}Primary Author
        </label>
        <Form.Field className="flex flex-col">
          <Dropdown
            id="primaryAuthorSelect"
            options={primaryAuthorOpts}
            onChange={(e, { value }) => {
              if (!value) {
                setSelectedPrimary(null);
                return;
              }
              const found = authorOptions.find((a) => a._id === value);
              if (!found) return;
              setSelectedPrimary(found);
            }}
            fluid
            selection
            search
            value={selectedPrimary?._id ?? ""}
            onSearchChange={(e, { searchQuery }) => {
              getAuthorsDebounced(searchQuery);
            }}
            placeholder="Seach authors..."
            loading={loadingAuthors}
          />
        </Form.Field>
      </div>
    );
  }
);

export default AuthorsForm;
