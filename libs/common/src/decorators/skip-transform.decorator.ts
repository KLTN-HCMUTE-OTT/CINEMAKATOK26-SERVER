// skip-transform.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const SKIP_TRANSFORM = 'skipTransform';
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM, true);