import axios from "axios";
import { useState } from "react";
import LoadingSpinner from "../LoadingSpinner";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import InsightEditor from "@libretexts/insight-ckeditor5-build";

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
    <div aria-busy={loading} {...rest}>
      {loading && <LoadingSpinner />}
      <CKEditor
      // @ts-ignore
        editor={InsightEditor}
        data={data}
        onReady={(editor) => {
          // @ts-ignore
          editor.plugins.get("FileRepository").createUploadAdapter = (
            // @ts-ignore
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
