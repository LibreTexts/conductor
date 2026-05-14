import React, { useCallback, useEffect, useRef, useState } from "react";
import type Uppy from "@uppy/core";
import { Button, Modal, Tabs } from "@libretexts/davis-react";
import { IconScreenShare } from "@tabler/icons-react";

interface ScreenCaptureModalProps {
  uppy: Uppy;
  disabled?: boolean;
}

type RecordingState = "idle" | "ready" | "recording" | "captured";

const ScreenCaptureModal: React.FC<ScreenCaptureModalProps> = ({
  uppy,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [state, setState] = useState<RecordingState>("idle");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const resetState = useCallback(() => {
    setState("idle");
    setCapturedBlob(null);
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
      setCapturedUrl(null);
    }
    setError(null);
    chunksRef.current = [];
    stopStream();
  }, [capturedUrl, stopStream]);

  const handleClose = useCallback(() => {
    resetState();
    setOpen(false);
    setTabIndex(0);
  }, [resetState]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [stopStream, capturedUrl]);

  const acquireStream = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState("ready");

      // If user stops sharing via browser UI, reset
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
        stopStream();
        setState((prev) => (prev === "captured" ? "captured" : "idle"));
      });
    } catch {
      setError("Screen sharing was cancelled or is not supported.");
      setState("idle");
    }
  }, [stopStream]);

  const startRecording = useCallback(async () => {
    if (!streamRef.current) {
      await acquireStream();
      // acquireStream sets state to "ready", but we want to start immediately
      // so we chain: if stream is available after acquire, start recording
    }

    const stream = streamRef.current;
    if (!stream) return; // user cancelled

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm",
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setCapturedBlob(blob);
      const url = URL.createObjectURL(blob);
      setCapturedUrl(url);
      setState("captured");
      stopStream();
      // Show the recorded video for review
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
      }
    };

    recorder.start();
    setState("recording");
  }, [acquireStream, stopStream]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const takeScreenshot = useCallback(async () => {
    if (!streamRef.current) {
      await acquireStream();
    }
    const stream = streamRef.current;
    if (!stream) return;

    const video = videoRef.current;
    if (!video) return;

    // Wait a frame for the video to render
    await new Promise((r) => requestAnimationFrame(r));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        const url = URL.createObjectURL(blob);
        setCapturedUrl(url);
        setState("captured");
        stopStream();
      }
    }, "image/png");
  }, [acquireStream, stopStream]);

  const handleSubmit = useCallback(() => {
    if (!capturedBlob) return;

    const isVideo = capturedBlob.type.startsWith("video/");
    const ext = isVideo ? "webm" : "png";
    const name = `screen-capture-${Date.now()}.${ext}`;

    try {
      uppy.addFile({
        name,
        type: capturedBlob.type,
        data: capturedBlob,
        source: "screen-capture",
      });
    } catch (err: any) {
      setError(err?.message ?? "Unable to add capture.");
      return;
    }

    handleClose();
  }, [capturedBlob, uppy, handleClose]);

  return (
    <>
      <Button
        variant="secondary"
        icon={<IconScreenShare size={16} />}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Screencast
      </Button>

      <Modal open={open} onClose={handleClose}>
        <Modal.Header>
          <Modal.Title>Screen Capture</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs selectedIndex={tabIndex} onChange={setTabIndex}>
            <Tabs.List>
              <Tabs.Tab>Record Video</Tabs.Tab>
              <Tabs.Tab>Screenshot</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panels>
              <Tabs.Panel>
                <div className="flex flex-col gap-4 pt-4">
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    <li>Click &ldquo;Start Recording&rdquo; and select the screen or window to capture.</li>
                    <li>Click &ldquo;Stop Recording&rdquo; when finished to review your recording.</li>
                    <li>Click &ldquo;Add to files&rdquo; to attach the recording.</li>
                  </ul>

                  {(state === "ready" || state === "recording" || state === "captured") && (
                    <video
                      ref={videoRef}
                      autoPlay={state !== "captured"}
                      muted={state !== "captured"}
                      controls={state === "captured"}
                      aria-label="Screen capture preview"
                      className="w-full rounded border border-gray-200 bg-black"
                    />
                  )}

                  <div role="status" aria-live="polite" className="sr-only">
                    {state === "recording" && "Recording in progress."}
                    {state === "captured" && "Recording complete. Review your capture before adding."}
                  </div>

                  <div className="flex gap-2">
                    {(state === "idle" || state === "ready") && (
                      <Button variant="primary" onClick={startRecording}>
                        Start Recording
                      </Button>
                    )}
                    {state === "recording" && (
                      <Button variant="primary" color="red" onClick={stopRecording}>
                        Stop Recording
                      </Button>
                    )}
                    {state === "captured" && (
                      <Button variant="secondary" onClick={resetState}>
                        Discard &amp; Retry
                      </Button>
                    )}
                  </div>
                </div>
              </Tabs.Panel>

              <Tabs.Panel>
                <div className="flex flex-col gap-4 pt-4">
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    <li>Click &ldquo;Take Screenshot&rdquo; and select the screen or window to capture.</li>
                    <li>The screenshot will appear below for review.</li>
                    <li>Click &ldquo;Add to files&rdquo; to attach the screenshot.</li>
                  </ul>

                  {state === "ready" && (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      aria-label="Screen preview"
                      className="w-full rounded border border-gray-200 bg-black"
                    />
                  )}

                  {state === "captured" && capturedUrl && (
                    <img
                      src={capturedUrl}
                      alt="Captured screenshot"
                      className="w-full rounded border border-gray-200"
                    />
                  )}

                  <div role="status" aria-live="polite" className="sr-only">
                    {state === "captured" && "Screenshot captured. Review before adding."}
                  </div>

                  <div className="flex gap-2">
                    {(state === "idle" || state === "ready") && (
                      <Button variant="primary" onClick={takeScreenshot}>
                        Take Screenshot
                      </Button>
                    )}
                    {state === "captured" && (
                      <Button variant="secondary" onClick={resetState}>
                        Discard &amp; Retry
                      </Button>
                    )}
                  </div>
                </div>
              </Tabs.Panel>
            </Tabs.Panels>
          </Tabs>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!capturedBlob}
          >
            Add to files
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ScreenCaptureModal;
