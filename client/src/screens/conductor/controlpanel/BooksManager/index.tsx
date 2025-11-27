import { useEffect, useRef, useState } from "react";
import { Grid, Header, Segment } from "semantic-ui-react";
import { UnpublishOrDeleteBookModal } from "../../../../components/controlpanel/BooksManager/UnpublishOrDeleteBookModal";
import { useModals } from "../../../../context/ModalContext";
import "../../../../components/controlpanel/ControlPanel.css";
import { useDocumentTitle } from "usehooks-ts";
import { useMutation } from "@tanstack/react-query";
import { Book, BookWithAutoMatched } from "../../../../types";
import { useTypedSelector } from "../../../../state/hooks";
import api from "../../../../api";
import CatalogTransferList from "../../../../components/NextGenComponents/CatalogTransferList";
import { IconEraser, IconLink, IconTrash } from "@tabler/icons-react";
import { getLicenseText } from "../../../../components/util/LicenseOptions";
import { useNotifications } from "../../../../context/NotificationContext";
import useCommonsCatalogBooks from "../../../../hooks/useCommonsCatalogBooks";
import useMasterCatalogV2 from "../../../../hooks/useMasterCatalogV2";
import BooksManagerHeader from "./BooksManagerHeader";
import Tooltip from "../../../../components/util/Tooltip";

/**
 * The Books Manager interface allows administrators to manage the Books
 * displayed in their Campus Commons and add them to Collections.
 */
const BooksManager = () => {
  useDocumentTitle("LibreTexts Conductor | Books Manager");

  const org = useTypedSelector((state) => state.org);
  const user = useTypedSelector((state) => state.user);
  const { closeAllModals, openModal } = useModals();
  const { addNotification } = useNotifications();

  const didInitializeCurrentCatalog = useRef<boolean>(false);
  const [selectedBooks, setSelectedBooks] = useState<BookWithAutoMatched[]>([]);

  const { data, isLoading, invalidate } = useMasterCatalogV2();
  const { data: commonsData, invalidate: invalidateCommonsData } =
    useCommonsCatalogBooks({});

  // Initialize the selected books from the current Commons catalog
  useEffect(() => {
    if (!commonsData || didInitializeCurrentCatalog.current) return;

    setSelectedBooks(commonsData);
    didInitializeCurrentCatalog.current = true;
  }, [commonsData]);

  function closeUnpublishOrDeleteModal() {
    closeAllModals();
    invalidate();
  }

  function openUnpublishOrDeleteModal(
    bookID: string,
    bookTitle: string,
    deleteMode: boolean = false
  ) {
    if (!bookID) return;

    openModal(
      <UnpublishOrDeleteBookModal
        bookID={bookID}
        bookTitle={bookTitle}
        deleteMode={deleteMode}
        onClose={closeUnpublishOrDeleteModal}
        open={true}
      />
    );
  }

  const saveChangesMutation = useMutation({
    mutationFn: (data: {
      addedBooks: BookWithAutoMatched[];
      removedBooks: BookWithAutoMatched[];
      excludedAutoMatchedBooks: BookWithAutoMatched[];
    }) => {
      return Promise.all([
        ...data.addedBooks.map((book) => api.enableBookOnCommons(book.bookID)),
        ...data.removedBooks.map((book) =>
          api.disableBookOnCommons(book.bookID)
        ),
        ...data.excludedAutoMatchedBooks.map((book) =>
          api.excludeBookFromAutoCatalogMatching(book.bookID)
        ),
      ]);
    },
    onSuccess(data, variables, context) {
      invalidateCommonsData();
      addNotification({
        type: "success",
        message: "Changes saved successfully.",
      });
    },
  });

  async function handleSelectedBooksChange(books: BookWithAutoMatched[]) {
    if (!didInitializeCurrentCatalog.current) return;
    if (!commonsData) return;
    // calculate the diff of commonsData and books to find which books were added or removed
    const commonsBookIDs = new Set(commonsData.map((b) => b.bookID));
    const newBookIDs = new Set(books.map((b) => b.bookID));
    const addedBooks = books.filter((b) => !commonsBookIDs.has(b.bookID));
    const removedBooks = commonsData.filter(
      (b) =>
        !newBookIDs.has(b.bookID) &&
        (org.autoCatalogMatchingDisabled ? true : !b.autoMatched) // Only consider non-auto-matched books for removal if auto-matching is enabled
    );
    const excludedAutoMatchedBooks = org.autoCatalogMatchingDisabled
      ? []
      : commonsData.filter(
          (b) => !newBookIDs.has(b.bookID) && b.autoMatched // Only consider auto-matched books for exclusion if auto-matching is enabled
        );
    await saveChangesMutation.mutateAsync({
      addedBooks,
      removedBooks,
      excludedAutoMatchedBooks,
    });
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Books Manager</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <BooksManagerHeader isMasterCatalogView={false} />
            <Segment loading={isLoading}>
              <CatalogTransferList
                availableData={data || { libraries: [] }}
                selectedBooks={selectedBooks}
                onSelectedBooksChange={(books) => {
                  setSelectedBooks(books);
                  handleSelectedBooksChange(books);
                }}
                transferDisabled={
                  !didInitializeCurrentCatalog.current ||
                  org.orgID === "libretexts"
                } // Ensure current catalog is loaded before allowing interactions
                selectedTitle={`${org.shortName} Custom Catalog`}
                renderBook={(item) => (
                  <div className="flex flex-col gap-y-1">
                    <div className="flex flex-row gap-2">
                      <p className="font-medium text-gray-900">
                        {item.title} ({item.bookID})
                      </p>
                      {item.autoMatched && (
                        <Tooltip text="This book was automatically matched to your Commons Catalog based on its library URL and your institution's name or aliases.">
                          <IconLink size={16} className="text-gray-500" />
                        </Tooltip>
                      )}
                    </div>

                    <p className="text-sm tracking-wide ">
                      {item.author ? item.author : "Author not specified"},{" "}
                      {getLicenseText(item.license)}
                    </p>
                  </div>
                )}
                bookActions={[
                  ...(user.isSuperAdmin && org.orgID === "libretexts"
                    ? [
                        {
                          label: "Unpublish Book",
                          icon: <IconEraser size={16} />,
                          onClick: (book: Book) => {
                            openUnpublishOrDeleteModal(
                              book.bookID,
                              book.title,
                              false
                            );
                          },
                        },
                        {
                          label: "Delete Book and Project",
                          icon: <IconTrash size={16} />,
                          onClick: (book: Book) => {
                            openUnpublishOrDeleteModal(
                              book.bookID,
                              book.title,
                              true
                            );
                          },
                        },
                      ]
                    : []),
                ]}
              />
              <div className="flex justify-center items-center mt-4">
                <a
                  href="/controlpanel/booksmanager/mastercatalog"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Browse Master Catalog in Plain View
                </a>
              </div>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default BooksManager;
