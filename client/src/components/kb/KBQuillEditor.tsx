import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface KBQuillEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  data: string | undefined;
  onDataChange: (newData: string) => void;
}

const KBQuillEditor: React.FC<KBQuillEditorProps> = ({
  data,
  onDataChange,
  ...rest
}) => {
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
      ["link", "image"],
      ["clean"],
    ],
  };

  return (
    <div {...rest}>
      <ReactQuill
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
