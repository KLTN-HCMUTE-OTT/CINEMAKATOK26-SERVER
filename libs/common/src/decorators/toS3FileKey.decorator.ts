import { Transform } from 'class-transformer';

export function ToS3FileKey(bucketUrl: string) {
  return Transform(({ value }) => {
    if (typeof value === 'string' && value.startsWith(bucketUrl)) {
      return value.replace(bucketUrl, '');
    }
    return value;
  });
}
