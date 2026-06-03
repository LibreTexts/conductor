import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import QRCodeStyling from "qr-code-styling";
import { useTypedSelector } from "../../../../state/hooks";
import { Button, Input } from "@libretexts/davis-react";
import { IconRefresh } from "@tabler/icons-react";
import { z } from "zod";

const URLSchema = z.string().url();

const QRCodeGenerator: React.FC = () => {
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);
  const [url, setUrl] = useState("https://libretexts.org");
  const [urlErr, setUrlErr] = useState(false);
  const [didGenerate, setDidGenerate] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDidGenerate(false);
    setUrlErr(false);
    if (qrRef.current) {
      qrRef.current.innerHTML = "";
    }
  }, [url]);

  const createQrCode = (targetUrl: string) => {
    return new QRCodeStyling({
      width: 300,
      height: 300,
      data: targetUrl,
      margin: 5,
      qrOptions: { typeNumber: 0, mode: "Byte", errorCorrectionLevel: "H" },
      imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 4 },
      dotsOptions: { type: "dots", color: "#000000" },
      backgroundOptions: { color: "#ffffff" },
      image: "https://cdn.libretexts.net/Logos/libretexts_icon.png",
      cornersSquareOptions: { type: "square", color: "#000000" },
      cornersDotOptions: { type: "square", color: "#000000" },
    });
  };

  const handleGenerate = () => {
    if (!url) return;
    const validation = URLSchema.safeParse(url);
    if (!validation.success) {
      setUrlErr(true);
      return;
    }
    const newQrCode = createQrCode(url);
    setDidGenerate(true);
    setTimeout(() => {
      if (qrRef.current) {
        qrRef.current.innerHTML = "";
        newQrCode.append(qrRef.current);
      }
    }, 100);
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="flex justify-center px-4 py-8">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-center text-gray-900">QR Code Generator</h1>

        <div className="border border-gray-200 rounded-lg p-8 bg-white flex flex-col gap-6">
          <Input
            name="qr-url"
            label="Enter URL for QR Code"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={urlErr}
            errorMessage="Please enter a valid URL."
          />
          <div className="flex justify-center">
            <Button
              variant="primary"
              icon={<IconRefresh size={16} />}
              disabled={!url}
              onClick={handleGenerate}
            >
              Generate QR Code
            </Button>
          </div>
        </div>

        {didGenerate && (
          <div className="border border-gray-200 rounded-lg p-8 bg-white">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-gray-600">QR Code for {url}</p>
              <div ref={qrRef} className="inline-block" />
              <p className="text-sm text-gray-500">
                Right-click the QR code to save or copy the image.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRCodeGenerator;
