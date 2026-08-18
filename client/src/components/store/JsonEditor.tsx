import CodeMirror from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** ID of the visible element labelling the editor. */
  labelledBy: string;
  /** IDs of elements describing the editor (e.g. a parse-error message). */
  describedBy?: string;
  height?: string;
  readOnly?: boolean;
}

/**
 * CodeMirror JSON editor. Imported lazily by its consumers so CodeMirror stays out of the
 * main bundle -- it is only reachable from superadmin screens.
 *
 * CodeMirror renders its own contenteditable element, so ARIA attributes have to be pushed
 * onto it through the `contentAttributes` facet rather than set on the React wrapper.
 */
const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  labelledBy,
  describedBy,
  height = "420px",
  readOnly = false,
}) => {
  return (
    <CodeMirror
      value={value}
      height={height}
      readOnly={readOnly}
      onChange={onChange}
      className="border border-gray-300 rounded-md overflow-hidden text-sm"
      extensions={[
        json(),
        linter(jsonParseLinter()),
        lintGutter(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-labelledby": labelledBy,
          ...(describedBy ? { "aria-describedby": describedBy } : {}),
        }),
      ]}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        autocompletion: false,
      }}
    />
  );
};

export default JsonEditor;
