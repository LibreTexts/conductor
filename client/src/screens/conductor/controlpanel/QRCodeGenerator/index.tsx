import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import QRCodeStyling from "qr-code-styling";
import { useTypedSelector } from "../../../../state/hooks";
import { Button, Input, Form, Header, Segment, Grid } from "semantic-ui-react";
import { z } from "zod";

const URLSchema = z.string().url();

const QRCodeGenerator: React.FC = () => {
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);
  const [url, setUrl] = useState("https://libretexts.org");
  const [didGenerate, setDidGenerate] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Reset state when URL changes
  useEffect(() => {
    setDidGenerate(false);
    if (qrRef.current) {
      qrRef.current.innerHTML = "";
    }
  }, [url]);

  // Create new QR code instance with the current URL
  const createQrCode = (targetUrl: string) => {
    const newQrCode = new QRCodeStyling({
      width: 300,
      height: 300,
      data: targetUrl,
      margin: 5,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "H",
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 4,
      },
      dotsOptions: {
        type: "dots",
        color: "#000000",
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      image: "https://cdn.libretexts.net/Logos/libretexts_icon.png",
      cornersSquareOptions: {
        type: "square",
        color: "#000000",
      },
      cornersDotOptions: {
        type: "square",
        color: "#000000",
      },
    });
    return newQrCode;
  };

  // Generate QR code with new URL and show modal
  const handleGenerate = () => {
    if (!url) return;

    const validation = URLSchema.safeParse(url);
    if (!validation.success) {
      alert("Invalid URL. Please enter a valid URL.");
      return;
    }

    const newQrCode = createQrCode(url);
    setDidGenerate(true);

    // Need to use a small delay to ensure the component has rendered
    setTimeout(() => {
      if (qrRef.current) {
        qrRef.current.innerHTML = "";
        newQrCode.append(qrRef.current);
      }
    }, 100);
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <Grid centered className="controlpanel-container">
      <Grid.Column width={10}>
        <Header
          as="h1"
          content="QR Code Generator"
          textAlign="center"
          className="mb-4"
        />
        <Segment padded="very">
          <Form>
            <Form.Field>
              <label>Enter URL for QR Code</label>
              <Input
                // type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                fluid
                size="large"
              />
            </Form.Field>
            <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
              <Button
                color="blue"
                icon="sync"
                content="Generate QR Code"
                onClick={() => handleGenerate()}
                size="large"
                disabled={!url}
              />
            </div>
          </Form>
        </Segment>
        {didGenerate && (
          <Segment padded="very">
            <div className="text-center">
              <p className="mb-2">QR Code for {url}</p>
              <div ref={qrRef} className="inline-block"></div>
              <p className="mt-2">
                Right-click the QR code to save or copy the image.
              </p>
            </div>
          </Segment>
        )}
      </Grid.Column>
    </Grid>
  );
};

export default QRCodeGenerator;
