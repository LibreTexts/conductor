import { useState, useEffect } from "react";
import {
  Card,
  Heading,
  IconButton,
  Pagination,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
import EditNoteModal from "./EditNoteModal";
import api from "../../api";
import useGlobalError from "../error/ErrorHooks";
import { Note, InternalNotesSectionProps } from "../../types/Note";

const NOTES_PER_PAGE = 10;

function formatAuthorLine(note: Note) {
  const created = `${note.created_by_user.first_name} ${
    note.created_by_user.last_name[0]
  }. • ${new Date(note.created_at).toLocaleString()}`;

  if (note.updated_at === note.created_at) return created;

  return `${created} | Last updated: ${note.updated_by_user.first_name} ${
    note.updated_by_user.last_name[0]
  }. • ${new Date(note.updated_at).toLocaleString()}`;
}

export default function InternalNotesSection({
  userId,
  canEdit = true,
}: InternalNotesSectionProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { handleGlobalError } = useGlobalError();

  useEffect(() => {
    fetchNotes();
  }, [userId, activePage]);

  async function fetchNotes() {
    setLoading(true);
    try {
      const res = await api.getUserNotes(userId, activePage, NOTES_PER_PAGE);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      setNotes(res.data.notes || []);
      setTotalPages(Math.ceil(res.data.total / NOTES_PER_PAGE));
    } catch (e) {
      handleGlobalError(e);
      setNotes([]);
    }
    setLoading(false);
  }

  function openNewNoteModal() {
    setEditingNote(null);
    setModalOpen(true);
  }

  function openEditNoteModal(note: Note) {
    setEditingNote(note);
    setModalOpen(true);
  }

  function handleModalClose(refresh = false) {
    setModalOpen(false);
    setEditingNote(null);
    if (refresh) fetchNotes();
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between gap-2">
          <Heading level={3}>Internal Notes (Newest First)</Heading>
          {canEdit && (
            <IconButton
              icon={<IconPlus />}
              aria-label="Add internal note"
              tooltip="Add internal note"
              size="sm"
              onClick={openNewNoteModal}
            />
          )}
        </div>
      </Card.Header>
      <Card.Body>
        <div className="max-h-[600px] overflow-y-auto break-words">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : notes.length === 0 ? (
            <Text color="muted">No notes yet.</Text>
          ) : (
            <Stack direction="vertical" gap="sm" as="ul" className="list-none">
              {notes.map((note) => {
                const body = (
                  <>
                    <Text as="p" className="whitespace-pre-wrap">
                      {note.content}
                    </Text>
                    <Text
                      as="p"
                      size="sm"
                      weight="semibold"
                      color="muted"
                      className="mt-2"
                    >
                      {formatAuthorLine(note)}
                    </Text>
                  </>
                );

                return (
                  <li key={note.uuid}>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => openEditNoteModal(note)}
                        className="w-full text-left border border-slate-300 p-2 rounded-md hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="border border-slate-300 p-2 rounded-md">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </Stack>
          )}
        </div>
      </Card.Body>
      {totalPages > 1 && (
        <Card.Footer className="flex justify-center">
          <Pagination
            page={activePage}
            totalPages={totalPages}
            onChange={setActivePage}
            size="sm"
          />
        </Card.Footer>
      )}
      <EditNoteModal
        open={modalOpen}
        onClose={handleModalClose}
        note={editingNote}
        userId={userId}
      />
    </Card>
  );
}
