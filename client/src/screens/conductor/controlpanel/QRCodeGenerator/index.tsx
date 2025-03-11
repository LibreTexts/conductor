import React, { useState, useEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { useTypedSelector } from "../../../../state/hooks";
import { Button, Input, Form, Container, Header, Segment, Modal, Grid } from 'semantic-ui-react';

const QRCodeGenerator: React.FC = () => {
  const isSuperAdmin = useTypedSelector((state) => {
    console.log("state:", state);
    return state.user.isSuperAdmin
  });
  const [url, setUrl] = useState('https://libretexts.org');
  const [qrCode, setQrCode] = useState<QRCodeStyling | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const modalQrRef = useRef<HTMLDivElement>(null);

  // Redirect non-superadmins to home
  useEffect(() => {
    if (!isSuperAdmin) {
      window.location.href = '/home';
    }
  }, [isSuperAdmin]);

  // Create new QR code instance with the current URL
  const createQrCode = (targetUrl: string) => {
    const newQrCode = new QRCodeStyling({
      width: 300,
      height: 300,
      data: targetUrl,
      margin: 5,
      qrOptions: {
        typeNumber: 0,
        mode: 'Byte',
        errorCorrectionLevel: 'H'
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.6,
        margin: 2
      },
      dotsOptions: {
        type: 'dots',
        color: '#000000',
        gradient: undefined
      },
      backgroundOptions: {
        color: '#ffffff',
        gradient: undefined
      },
      image: "https://cdn.libretexts.net/Logos/libretexts_icon.png",
      cornersSquareOptions: {
        type: 'square',
        color: '#000000'
      },
      cornersDotOptions: {
        type: 'square',
        color: '#000000'
      },
    });
    return newQrCode;
  };

  // Initialize QR code on component mount
  useEffect(() => {
    if (isSuperAdmin) {
      const newQrCode = createQrCode(url);
      setQrCode(newQrCode);
    }
  }, [isSuperAdmin]);

  // Generate QR code with new URL and show modal
  const handleGenerate = () => {
    const newQrCode = createQrCode(url);
    setQrCode(newQrCode);
    setModalOpen(true);
    
    // Need to use a small delay to ensure the modal has rendered
    setTimeout(() => {
      if (modalQrRef.current) {
        modalQrRef.current.innerHTML = '';
        newQrCode.append(modalQrRef.current);
      }
    }, 100);
  };
  
  if (!isSuperAdmin) {
    return null;
  }

  return (
    <Container>
      <Header as="h1" content="QR Code Generator" textAlign="center" dividing style={{ marginBottom: '2rem' }} />
      
      <Grid centered>
        <Grid.Column width={10}>
          <Segment padded="very">
            <Form>
              <Form.Field>
                <label>Enter URL for QR Code</label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  fluid
                  size="large"
                />
              </Form.Field>
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <Button
                  color="blue"
                  icon="sync"
                  content="Generate QR Code"
                  onClick={handleGenerate}
                  size="large"
                />
              </div>
            </Form>
          </Segment>
        </Grid.Column>
      </Grid>

      {/* QR Code Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="small"
        centered={false}
      >
        <Modal.Header>QR Code for {url}</Modal.Header>
        <Modal.Content>
          <div style={{ textAlign: 'center' }}>
            <div ref={modalQrRef} style={{ display: 'inline-block' }}></div>
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={() => setModalOpen(false)}>Close</Button>
        </Modal.Actions>
      </Modal>
    </Container>
  );
};

export default QRCodeGenerator;