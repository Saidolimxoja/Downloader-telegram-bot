export class VideoInfoDto {
  id: string;
  title: string;
  uploader: string | null;
  duration: number | null;
  viewCount: number | null;
  likeCount: number | null;
  uploadDate: string | null;
  thumbnail: string | null;
  formats: FormatDto[];
  url: any;
}

export class FormatDto {
  formatId: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  quality: number;
  hasAudio: boolean;
}