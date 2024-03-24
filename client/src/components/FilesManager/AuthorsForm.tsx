import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Button, Dropdown, Form, Icon } from "semantic-ui-react";
import { Author } from "../../types";
import useGlobalError from "../error/ErrorHooks";
import useDebounce from "../../hooks/useDebounce";
import api from "../../api";
import { ProjectFileAuthor } from "../../types/Project";
import ManualEntryModal from "../util/ManualEntryModal";

interface AuthorsFormProps {
  mode: "project-default" | "file";
  currentPrimaryAuthor?: ProjectFileAuthor;
  currentAuthors?: ProjectFileAuthor[];
}

type AuthorsFormRef = {
  getAuthors: () => {
    primaryAuthor: ProjectFileAuthor | null;
    authors: ProjectFileAuthor[];
  };
};

const AuthorsForm = forwardRef(
  (props: AuthorsFormProps, ref: React.ForwardedRef<AuthorsFormRef>) => {
    const { mode, currentPrimaryAuthor, currentAuthors } = props;

    const { handleGlobalError } = useGlobalError();
    const { debounce } = useDebounce();

    const [authorOptions, setAuthorOptions] = useState<ProjectFileAuthor[]>([]);
    const [loadingAuthors, setLoadingAuthors] = useState(false);
    const [showNewAuthorModal, setShowNewAuthorModal] = useState(false);
    const [manualEntryLocation, setManualEntryLocation] = useState<
      "primary" | "secondary"
    >("primary");

    const [selectedPrimary, setSelectedPrimary] =
      useState<ProjectFileAuthor | null>(currentPrimaryAuthor ?? null);
    const [selectedSecondary, setSelectedSecondary] = useState<
      ProjectFileAuthor[]
    >(currentAuthors ?? []);

    useImperativeHandle(ref, () => ({
      getAuthors: () => ({
        primaryAuthor: selectedPrimary,
        authors: selectedSecondary,
      }),
    }));

    useEffect(() => {
      loadAuthorOptions();
    }, []);

    // We need to update the selected authors when the current authors change
    // since that data may not be available when the component is first rendered
    useEffect(() => {
      setSelectedPrimary(currentPrimaryAuthor ?? null);
      setSelectedSecondary(currentAuthors ?? []);
    }, [currentPrimaryAuthor, currentAuthors])

    async function loadAuthorOptions(searchQuery?: string) {
      try {
        setLoadingAuthors(true);
        const res = await api.getAuthors({ query: searchQuery });
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }
        if (!res.data.authors) {
          throw new Error("Failed to load author options");
        }

        setAuthorOptions(res.data.authors);
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

    const handleAddAuthor = (newAuthor: Author) => {
      setAuthorOptions([...authorOptions, newAuthor]);

      // Set the manually added author as the primary or secondary author
      // based on where the manual entry was triggered
      if (manualEntryLocation === "primary") {
        setSelectedPrimary(newAuthor);
      }

      if (manualEntryLocation === "secondary") {
        if (currentAuthors) {
          setSelectedSecondary([...currentAuthors, newAuthor]);
        } else {
          setSelectedSecondary([newAuthor]);
        }
      }
    };

    const ManualEntryButton = ({ from }: { from: "primary" | "secondary" }) => (
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setManualEntryLocation(from);
            setShowNewAuthorModal(true);
          }}
          basic
          size="mini"
          color="blue"
          className="!-mt-1"
        >
          <Icon name="plus" />
          Manual Entry
        </Button>
      </div>
    );

    const primaryAuthorOpts = useMemo(() => {
      const opts = authorOptions
        .filter((a) => !selectedSecondary?.find((ca) => ca._id === a._id))
        .map((a) => ({
          key: crypto.randomUUID(),
          value: a._id ?? "",
          text: `${a.firstName} ${a.lastName}`,
        }));

      opts.unshift({
        key: crypto.randomUUID(),
        value: "",
        text: "Clear...",
      });

      return opts;
    }, [authorOptions, selectedSecondary]);

    const secondaryAuthorOpts = useMemo(() => {
      const opts = authorOptions
        .filter((a) => !selectedPrimary || a._id !== selectedPrimary._id)
        .map((a) => ({
          key: crypto.randomUUID(),
          value: a._id ?? "",
          text: `${a.firstName} ${a.lastName}`,
        }));

      opts.unshift({
        key: crypto.randomUUID(),
        value: "",
        text: "Clear...",
      });

      return opts;
    }, [authorOptions, selectedPrimary]);

    return (
      <>
        <div className="mt-4">
          <label className="form-field-label">
            {mode === "project-default" ? "Default " : ""}Primary Author
          </label>
          <Form.Field className="flex flex-col">
            <Dropdown
              id="primaryAuthorSelect"
              options={primaryAuthorOpts}
              onChange={(e, data) => {
                if (!data.value) return;
                const found = authorOptions.find((a) => a._id === data.value);
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
          <ManualEntryButton from="primary" />
        </div>
        <div>
          <Form.Field className="flex flex-col">
            <label htmlFor="existingAuthorSelect">
              {mode === "project-default" ? "Default " : ""}Additional Author(s)
            </label>
            <Dropdown
              id="existingAuthorSelect"
              placeholder="Search authors..."
              options={secondaryAuthorOpts}
              onChange={(e, { value }) => {
                if (!value) return;
                const foundEntries = authorOptions.filter(
                  (a) => a._id && (value as string[])?.includes(a._id)
                );
                setSelectedSecondary(foundEntries);
              }}
              fluid
              selection
              search
              multiple
              value={
                selectedSecondary
                  .filter((a) => !!a)
                  .map((a) => a._id) as string[]
              }
              onSearchChange={(e, { searchQuery }) => {
                getAuthorsDebounced(searchQuery);
              }}
              loading={loadingAuthors}
            />
          </Form.Field>
          <ManualEntryButton from="secondary" />
        </div>
        <ManualEntryModal
          show={showNewAuthorModal}
          onClose={() => setShowNewAuthorModal(false)}
          onSaved={(author) => {
            handleAddAuthor(author);
            setShowNewAuthorModal(false);
          }}
        />
      </>
    );
  }
);

export default AuthorsForm;
