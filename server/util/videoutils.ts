import axios from 'axios';

export async function generateVideoStreamURL(videoID: string) {
  try {
    if (
      !process.env.CLOUDFLARE_STREAM_ACCOUNT_ID
      || !process.env.CLOUDFLARE_STREAM_API_TOKEN
      || !process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
    ) {
      throw new Error(`Unable to generate video stream URL for "${videoID}": missing configuration variables.`);
    }

    const streamRes = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream/${videoID}/token`,
      undefined,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
        },
      }
    );
    if (!streamRes.data?.success) {
      throw new Error(`Error from Cloudflare API: ${JSON.stringify(streamRes.data)}`);
    }
    if (!streamRes.data?.result?.token) {
      throw new Error(`Unexpected response from Cloudflare API: ${JSON.stringify(streamRes.data)}`);
    }
    return `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${streamRes.data.result.token}/iframe`;
  } catch (err) {
    console.error(`Error generating video stream URL for "${videoID}".`, err);
  }
  return null;
}
