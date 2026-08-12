/**
 * A typed HTTPS media input. Use image_url for images and media_url for audio or video. Roles describe how the model should use the input; provider and model support varies.
 */
export type VideoInputReference =
  | {
      image_url: {
        url: string;
      };
      reference_type?: string;
      role?: "first_frame" | "last_frame" | "reference" | "source" | "mask";
      type: "image_url";
    }
  | {
      media_url: {
        url: string;
      };
      reference_type?: string;
      role?: "first_frame" | "last_frame" | "reference" | "source" | "mask";
      type: "video_url" | "audio_url";
    };
