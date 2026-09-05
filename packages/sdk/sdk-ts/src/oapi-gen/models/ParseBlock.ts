export type ParseBlock =
  | {
      text: {
        content: string;
      };
      type: "text";
    }
  | {
      image: {
        bounding_box: {
          bottom_right_x: number;
          bottom_right_y: number;
          top_left_x: number;
          top_left_y: number;
        };
        bounding_box_normalized: {
          bottom_right_x: number;
          bottom_right_y: number;
          top_left_x: number;
          top_left_y: number;
        };
        category: "other" | "flowchart" | "logo" | "signature";
        description: string;
        id: string;
      };
      type: "image";
    }
  | {
      table: {
        bounding_box: {
          bottom_right_x: number;
          bottom_right_y: number;
          top_left_x: number;
          top_left_y: number;
        };
        bounding_box_normalized: {
          bottom_right_x: number;
          bottom_right_y: number;
          top_left_x: number;
          top_left_y: number;
        };
        description?: string;
        html: string;
        title?: string;
        type: "html";
      };
      type: "table";
    };
