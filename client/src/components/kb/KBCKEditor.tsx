import axios from "axios";
import { useState } from "react";
import LoadingSpinner from "../LoadingSpinner";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Alignment,
  AutoImage,
  Autoformat,
  BlockQuote,
  Bold,
  ClassicEditor,
  type EditorConfig,
  Essentials,
  GeneralHtmlSupport,
  Heading,
  Image,
  ImageCaption,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Indent,
  Italic,
  Link,
  List,
  MediaEmbed,
  Paragraph,
  PasteFromOffice,
  SourceEditing,
  Table,
  TableCaption,
  TableToolbar,
  TextTransformation,
  Undo,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";

const EDITOR_CONFIG: EditorConfig = {
  licenseKey: "GPL",
  plugins: [
    Alignment,
    AutoImage,
    Autoformat,
    BlockQuote,
    Bold,
    Essentials,
    GeneralHtmlSupport,
    Heading,
    Image,
    ImageCaption,
    ImageStyle,
    ImageToolbar,
    ImageUpload,
    Indent,
    Italic,
    Link,
    List,
    MediaEmbed,
    Paragraph,
    PasteFromOffice,
    SourceEditing,
    Table,
    TableCaption,
    TableToolbar,
    TextTransformation,
    Undo,
  ],
  toolbar: {
    items: [
      "undo",
      "redo",
      "heading",
      "|",
      "bold",
      "italic",
      "link",
      "bulletedList",
      "numberedList",
      "|",
      "alignment",
      "outdent",
      "indent",
      "|",
      "imageUpload",
      "blockQuote",
      "insertTable",
      "mediaEmbed",
      "sourceEditing",
    ],
  },
  language: "en",
  image: {
    toolbar: [
      "imageTextAlternative",
      "toggleImageCaption",
      "imageStyle:inline",
      "imageStyle:block",
      "imageStyle:side",
    ],
  },
  table: {
    contentToolbar: [
      "tableColumn",
      "tableRow",
      "mergeTableCells",
      "toggleTableCaption",
    ],
  },
  // Preserve arbitrary markup (inline styles, classes, <div>, <figcaption>, etc.)
  // written in Source mode. The server and KBRenderer both run DOMPurify, so
  // this only governs what survives the editor round-trip.
  htmlSupport: {
    allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
    disallow: [
      { name: /^(script|style)$/i },
      { name: /.*/, attributes: [/^on/i] },
    ],
  },
};

interface KBCKEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  data: string | undefined;
  onDataChange: (newData: string) => void;
  pageUUID: string;
}

const KBCKEditor: React.FC<KBCKEditorProps> = ({
  data,
  onDataChange,
  pageUUID,
  ...rest
}) => {
  const [loading, setLoading] = useState(false);

  class ImageUploadAdapterPlugin {
    private loader: any;
    constructor(loader: any) {
      this.loader = loader;
    }

    upload() {
      return this.loader.file.then(
        (file: any) =>
          new Promise((resolve, reject) => {
            const myReader = new FileReader();
            myReader.addEventListener("loadend", (e: any) => {
              this.sendRequest(file).then((res) => {
                if (!res || typeof res !== "string") reject("Invalid response");
                resolve({ default: res });
              });
            });
            myReader.readAsDataURL(file);
          })
      );
    }

    async sendRequest(file: File) {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await axios.post(
        `/kb/page/${pageUUID}/files`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      if (uploadRes.data.err || !uploadRes.data.url) {
        throw new Error(uploadRes.data.errMsg);
      }
      return uploadRes.data.url;
    }
  }

  return (
    <div className="kb-content" aria-busy={loading} {...rest}>
      {loading && <LoadingSpinner />}
      <CKEditor
        editor={ClassicEditor}
        config={EDITOR_CONFIG}
        data={data}
        onReady={(editor) => {
          editor.plugins.get("FileRepository").createUploadAdapter = (
            loader
          ) => {
            return new ImageUploadAdapterPlugin(loader);
          };
        }}
        onChange={(event, editor) => {
          const data = editor.data.get();
          onDataChange(data);
        }}
      />
      <p className="text-xs text-gray-500 italic ml-1">
        Caution: When using Source mode, ensure you toggle back to WYSIWYG mode
        before saving. Otherwise, your changes may be lost. CKEditor will ignore
        invalid HTML when toggling back to WYSIWYG mode.
      </p>
    </div>
  );
};

export default KBCKEditor;
