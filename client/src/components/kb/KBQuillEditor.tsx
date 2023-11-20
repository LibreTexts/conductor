import axios from "axios";
import { useRef, useEffect, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import LoadingSpinner from "../LoadingSpinner";

interface KBQuillEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  data: string | undefined;
  onDataChange: (newData: string) => void;
  pageUUID?: string;
}

const KBQuillEditor: React.FC<KBQuillEditorProps> = ({
  data,
  onDataChange,
  pageUUID,
  ...rest
}) => {
  const editorRef = useRef<ReactQuill>(null);
  const [loading, setLoading] = useState(false);

  // Register image upload handler
  useEffect(() => {
    const quillObj = editorRef?.current?.getEditor();
    if (!quillObj) return console.error("Quill object not found");
    const toolbar = quillObj.getModule("toolbar");
    if (!toolbar) return console.error("Quill toolbar not found");
    toolbar.addHandler("image", imageUploadHandler);
  }, [editorRef, pageUUID]);

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, 4, false] }],
      [{ font: [] }],
      [
        { color: [] },
        { background: [] },
        "bold",
        "italic",
        "underline",
        "strike",
        "blockquote",
      ],
      [
        { list: "ordered" },
        { list: "bullet" },
        { indent: "-1" },
        { indent: "+1" },
      ],
      ["link", "image", 'video'],
      ["clean"],
    ],
  };

  const imageUploadHandler = async () => {
    const uuid = pageUUID;
    // Create hidden input element
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      setLoading(true);
      const file = input.files ? input.files[0] : null;

      if (!uuid) return console.error("Page UUID not found");

      const quillObj = editorRef?.current?.getEditor();
      if (!quillObj) return console.error("Quill object not found");
      const range = quillObj?.getSelection();
      if (!range) return console.error("Quill range not found");

      if (!file) {
        return console.error("File not found");
      }

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await axios.post(`/kb/page/${uuid}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (uploadRes.data.err || !uploadRes.data.url) {
        throw new Error(uploadRes.data.errMsg);
      }

      quillObj.insertEmbed(range.index, "image", uploadRes.data.url);
      setLoading(false);
    };
  };

  return (
    <div aria-busy={loading} {...rest}>
      {loading && <LoadingSpinner />}
      <ReactQuill
        ref={editorRef}
        theme="snow"
        placeholder="Write something awesome..."
        value={data}
        modules={modules}
        onChange={(content, delta, source, editor) => {
          onDataChange(editor.getHTML());
        }}
      />
    </div>
  );
};

export default KBQuillEditor;
