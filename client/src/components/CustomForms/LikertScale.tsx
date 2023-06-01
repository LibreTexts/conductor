import {
  threePointLikertOptions,
  fivePointLikertOptions,
  sevenPointLikertOptions,
} from "../util/LikertHelpers";

interface LikertScaleProps {
  points: 3 | 5 | 7;
  promptOrder: number;
  pointChecked: number;
  onPointChange: (newVal: number) => void;
  error: boolean;
};

/**
 * Renders a Likert Scale response input.
 * @param {Object} props - Props to pass to the Likert Scale.
 * @param {Number} props.points - The number of Likert points to render (3,5,7).
 * @param {Number} props.promptOrder - The 'order' property of the containing prompt.
 * @param {Number} props.pointChecked - The value of the currently checked point.
 * @param {Function} props.onPointChange - The handler to run when the checked point is changed.
 * @param {Boolean} props.error - If the scale is in an error state.
 * @returns {JSX.Element} A div containing the rendered Likert Scale.
 */
const LikertScale: React.FC<LikertScaleProps> = ({
  points,
  promptOrder,
  pointChecked,
  onPointChange,
  error,
}) => {
  let pointOptions: string[] = [];
  if (points === 3) {
    pointOptions = threePointLikertOptions;
  } else if (points === 5) {
    pointOptions = fivePointLikertOptions;
  } else if (points === 7) {
    pointOptions = sevenPointLikertOptions;
  }
  return (
    <div className="likert-row">
      {pointOptions.map((item, idx) => {
        let likertIndex = idx + 1;
        return (
          <div
            className="likert-option"
            key={`prompt-${promptOrder}-container-${likertIndex}`}
          >
            <input
              type="radio"
              name={`prompt-${promptOrder}`}
              value={likertIndex}
              id={`prompt-${promptOrder}-${likertIndex}`}
              checked={pointChecked === likertIndex}
              onChange={(e) => {
                if (onPointChange !== undefined)
                  onPointChange(
                    !Number.isNaN(parseInt(e.target.value.toString()))
                      ? parseInt(e.target.value.toString()) // If !NaN return parsed value, else return 0
                      : 0
                  );
              }}
            />
            <label
              htmlFor={`prompt-${promptOrder}-${likertIndex}`}
              className={`${error ? "form-error-label" : ""}`}
            >
              {item}
            </label>
          </div>
        );
      })}
    </div>
  );
};

export default LikertScale;
