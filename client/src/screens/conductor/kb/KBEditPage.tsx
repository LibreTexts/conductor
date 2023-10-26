import { useParams } from "react-router-dom";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import DefaultLayout from "../../../components/kb/DefaultLayout";
import { Button, Icon } from "semantic-ui-react";
import NavTree from "../../../components/kb/NavTree";
import DefaultLayoutWNavTree from "../../../components/kb/DefaultLayoutWNavTree";

const KBEditPage = () => {
  const { id } = useParams<{ id: any }>();

  return (
    <DefaultLayoutWNavTree>
      <div className="flex flex-row justify-between">
        <p className="text-3xl font-semibold">Editing Page: {id}</p>
        <Button color="green">
          <Icon name="save" />
          Save
        </Button>
      </div>
      <div className="my-8">
        <CKEditor
          editor={ClassicEditor}
          data="<p>Hello from CKEditor&nbsp;5!</p>"
          onChange={(event, editor) => {
            const data = editor.getData();
            console.log({ event, editor, data });
          }}
          onBlur={(event, editor) => {
            console.log("Blur.", editor);
          }}
          onFocus={(event, editor) => {
            console.log("Focus.", editor);
          }}
        />
      </div>
      <div className="flex flex-row justify-end">
        <Button color="green">
          <Icon name="save" />
          Save
        </Button>
      </div>
    </DefaultLayoutWNavTree>
  );
};

export default KBEditPage;
