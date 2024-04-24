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
  currentCorrespondingAuthor?: ProjectFileAuthor;
}

type AuthorsFormRef = {
  getAuthors: () => {
    primaryAuthor: ProjectFileAuthor | null;
    authors: ProjectFileAuthor[];
    correspondingAuthor: ProjectFileAuthor | null;
  };
};

const AuthorsForm = forwardRef(
  (props: AuthorsFormProps, ref: React.ForwardedRef<AuthorsFormRef>) => {
    const {
      mode,
      currentPrimaryAuthor,
      currentAuthors,
      currentCorrespondingAuthor,
    } = props;

    const { handleGlobalError } = useGlobalError();
    const { debounce } = useDebounce();

    const [authorOptions, setAuthorOptions] = useState<ProjectFileAuthor[]>([]);
    const [secondaryAuthorOptions, setSecondaryAuthorOptions] = useState<
      ProjectFileAuthor[]
    >([]);
    const [correspondingAuthorOptions, setCorrespondingAuthorOptions] =
      useState<ProjectFileAuthor[]>([]);

    const [loadingAuthors, setLoadingAuthors] = useState(false);
    const [loadingSecondaryAuthors, setLoadingSecondaryAuthors] =
      useState(false);
    const [loadingCorrespondingAuthors, setLoadingCorrespondingAuthors] =
      useState(false);
    const [showNewAuthorModal, setShowNewAuthorModal] = useState(false);
    const [manualEntryLocation, setManualEntryLocation] = useState<
      "primary" | "secondary" | "corresponding"
    >("primary");

    const [selectedPrimary, setSelectedPrimary] =
      useState<ProjectFileAuthor | null>(currentPrimaryAuthor ?? null);
    const [selectedSecondary, setSelectedSecondary] = useState<
      ProjectFileAuthor[]
    >(currentAuthors ?? []);
    const [selectedCorresponding, setSelectedCorresponding] =
      useState<ProjectFileAuthor | null>(currentCorrespondingAuthor ?? null);

    useImperativeHandle(ref, () => ({
      getAuthors: () => ({
        primaryAuthor: selectedPrimary,
        authors: selectedSecondary,
        correspondingAuthor: selectedCorresponding,
      }),
    }));

    useEffect(() => {
      loadAuthorOptions(undefined, true);
    }, []);

    // We need to update the selected authors when the current authors change
    // since that data may not be available when the component is first rendered
    useEffect(() => {
      setSelectedPrimary(currentPrimaryAuthor ?? null);
      setSelectedSecondary(currentAuthors ?? []);
      setSelectedCorresponding(currentCorrespondingAuthor ?? null);
    }, [currentPrimaryAuthor, currentAuthors, currentCorrespondingAuthor]);

    async function loadAuthorOptions(searchQuery?: string, setOthers = false) {
      try {
        setLoadingAuthors(true);
        const res = await api.getAuthors({ query: searchQuery });
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }
        if (!res.data.authors || !Array.isArray(res.data.authors)) {
          throw new Error("Failed to load author options");
        }

        const opts = [
          ...res.data.authors,
          ...(selectedPrimary ? [selectedPrimary] : []),
        ];

        setAuthorOptions(opts);

        // We only use this when loading the authors for the first time
        // so we don't need to run the same query multiple times
        if (setOthers) {
          setSecondaryAuthorOptions(opts);
          setCorrespondingAuthorOptions(opts);
        }
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoadingAuthors(false);
      }
    }

    async function loadSecondaryAuthorOptions(searchQuery?: string) {
      try {
        setLoadingSecondaryAuthors(true);
        const res = await api.getAuthors({ query: searchQuery });
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }
        if (!res.data.authors || !Array.isArray(res.data.authors)) {
          throw new Error("Failed to load author options");
        }

        const opts = [...res.data.authors, ...(selectedSecondary ?? [])];

        const unique = opts.filter(
          (a, i, self) => self.findIndex((b) => b._id === a._id) === i
        );

        setSecondaryAuthorOptions(unique);
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoadingSecondaryAuthors(false);
      }
    }

    async function loadCorrespondingAuthorOptions(searchQuery?: string) {
      try {
        setLoadingCorrespondingAuthors(true);
        const res = await api.getAuthors({ query: searchQuery });
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }
        if (!res.data.authors || !Array.isArray(res.data.authors)) {
          throw new Error("Failed to load author options");
        }

        const opts = [
          ...res.data.authors,
          ...(selectedCorresponding ? [selectedCorresponding] : []),
        ];

        setCorrespondingAuthorOptions(opts);
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoadingCorrespondingAuthors(false);
      }
    }

    const getAuthorsDebounced = debounce(
      (searchQuery?: string) => loadAuthorOptions(searchQuery),
      200
    );

    const getSecondaryAuthorsDebounced = debounce(
      (searchQuery?: string) => loadSecondaryAuthorOptions(searchQuery),
      200
    );

    const getCorrespondingAuthorsDebounced = debounce(
      (searchQuery?: string) => loadCorrespondingAuthorOptions(searchQuery),
      200
    );

    const handleAddAuthor = (newAuthor: Author) => {
      setAuthorOptions([...authorOptions, newAuthor]);

      // Set the manually added author as the primary or secondary author
      // based on where the manual entry was triggered
      if (manualEntryLocation === "primary") {
        setSelectedPrimary(newAuthor);
      }

      if (manualEntryLocation === "corresponding") {
        setSelectedCorresponding(newAuthor);
      }

      if (manualEntryLocation === "secondary") {
        if (currentAuthors) {
          setSelectedSecondary([...currentAuthors, newAuthor]);
        } else {
          setSelectedSecondary([newAuthor]);
        }
      }
    };

    const ManualEntryButton = ({
      from,
    }: {
      from: "primary" | "secondary" | "corresponding";
    }) => (
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
      const opts = secondaryAuthorOptions
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
    }, [secondaryAuthorOptions, selectedPrimary]);

    const correspondingAuthorOpts = useMemo(() => {
      const opts = correspondingAuthorOptions.map((a) => ({
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
    }, [correspondingAuthorOptions]);

    return (
      <>
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
          <ManualEntryButton from="primary" />
        </div>
        <div className="mt-4">
          <label
            className="form-field-label"
            htmlFor="correspondingAuthorSelect"
          >
            {mode === "project-default" ? "Default " : ""}Contact Person
          </label>
          <Form.Field className="flex flex-col">
            <Dropdown
              id="correspondingAuthorSelect"
              options={correspondingAuthorOpts}
              onChange={(e, { value }) => {
                if (!value) {
                  setSelectedCorresponding(null);
                  return;
                }
                const found = correspondingAuthorOptions.find(
                  (a) => a._id === value
                );
                if (!found) return;
                setSelectedCorresponding(found);
              }}
              fluid
              selection
              search
              value={selectedCorresponding?._id ?? ""}
              onSearchChange={(e, { searchQuery }) => {
                getCorrespondingAuthorsDebounced(searchQuery);
              }}
              placeholder="Seach authors..."
              loading={loadingCorrespondingAuthors}
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

                // If 'clear' is selected, the last value will be an empty string
                if (Array.isArray(value) && value[value.length - 1] === "") {
                  setSelectedSecondary([]);
                  return;
                }
                const foundEntries = secondaryAuthorOptions.filter(
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
                getSecondaryAuthorsDebounced(searchQuery);
              }}
              loading={loadingSecondaryAuthors}
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
