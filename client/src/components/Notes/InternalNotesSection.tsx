import React, { useState, useEffect } from "react";
import {
  Segment,
  Header,
  Button,
  Icon,
  List,
  Loader,
  Pagination,
} from "semantic-ui-react";
import EditNoteModal from "./EditNoteModal";
import api from "../../api";
import useGlobalError from "../../components/error/ErrorHooks";
import { Note, InternalNotesSectionProps } from "../../types/Note";

export default function InternalNotesSection({
  userId,
  canEdit = true,
}: InternalNotesSectionProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { handleGlobalError } = useGlobalError();

  const [limit, setLimit] = useState(10);

  useEffect(() => {
    fetchNotes();
  }, [userId, activePage]);

  async function fetchNotes() {
    setLoading(true);
    try {
      const res = await api.getUserNotes(userId, activePage, limit);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      setNotes(res.data.notes || []);
      setTotalPages(Math.ceil(res.data.total / limit));
    } catch (e) {
      handleGlobalError(e);
      setNotes([]);
    }
    setLoading(false);
  }

  function handlePageChange(e: React.MouseEvent, data: any) {
    setActivePage(data.activePage);
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
    <Segment className="flex flex-col overflow-hidden max-h-[800px] !shadow-none !border-none !px-0">
      <div className="flex justify-between items-cente mb-4 border-b border-slate-300 pb-2">
        <Header as="h3" className="!m-0">
          Internal Notes (Newest First)
        </Header>
        {canEdit && (
          <Button color="blue" icon size="tiny" onClick={openNewNoteModal}>
            <Icon name="plus" />
          </Button>
        )}
      </div>
      <div className="overflow-y-auto break-words pl-0.5 pr-4">
        {loading ? (
          <Loader active inline="centered" />
        ) : (
          <>
            <List divided relaxed>
              {notes.length === 0 && <div>No notes yet.</div>}
              {notes.map((note) => (
                <List.Item
                  key={note.uuid}
                  style={{ cursor: canEdit ? "pointer" : "default" }}
                  onClick={canEdit ? () => openEditNoteModal(note) : undefined}
                  className="border border-slate-300 mb-2 !p-2 shadow-md rounded-md"
                >
                  <List.Content className="p-1">
                    <List.Description className="whitespace-pre-wrap text-base text-black">
                      {note.content}
                    </List.Description>
                    <div className="text-sm mt-2 flex flex-col gap-1 font-semibold">
                      <div>
                        {note.created_by_user.first_name}{" "}
                        {note.created_by_user.last_name[0]}. •{" "}
                        {new Date(note.created_at).toLocaleString()}
                        {note.updated_at !== note.created_at && (
                          <>
                            {" "}
                            | Last updated: {
                              note.updated_by_user.first_name
                            }{" "}
                            {note.updated_by_user.last_name[0]}. •{" "}
                            {new Date(note.updated_at).toLocaleString()}
                          </>
                        )}
                      </div>
                    </div>
                  </List.Content>
                </List.Item>
              ))}
            </List>
          </>
        )}
      </div>
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "0.5rem 0",
          }}
        >
          <Pagination
            activePage={activePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            size="mini"
            firstItem={null}
            lastItem={null}
          />
        </div>
      )}
      <EditNoteModal
        open={modalOpen}
        onClose={handleModalClose}
        note={editingNote}
        userId={userId}
      />
    </Segment>
  );
}
