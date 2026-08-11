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
