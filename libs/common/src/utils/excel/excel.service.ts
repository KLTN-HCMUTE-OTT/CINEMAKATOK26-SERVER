import * as fs from 'fs';
import * as path from 'path';

import archiver from 'archiver';
import * as ExcelJS from 'exceljs';

import { Injectable, Logger } from '@nestjs/common';

import { getConfig } from '../get-config';

@Injectable()
export class ExcelService {
  private readonly logger = new Logger(ExcelService.name);
  private readonly EXPORT_FOLDER: string = getConfig(
    'core.excelService.exportTempFolder',
    './exports',
  ) as string;

  constructor() {
    if (!fs.existsSync(this.EXPORT_FOLDER)) {
      fs.mkdirSync(this.EXPORT_FOLDER, { recursive: true });
    }
  }

  async exportToExcel<T>(
    data: T[],
    filePath: string,
    viewExport: string,
    transformerRow: (data: T, idx?: number) => Record<string, any>,
    columns: { header: string; key: string; width?: number }[],
    sheetName: string,
  ): Promise<void> {
    this.logger.verbose(`start create work book`);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    this.logger.verbose(`start export data to excel with view export; ${viewExport}`);

    data.forEach((item, idx) => {
      sheet.addRow(transformerRow(item, idx));
    });

    await workbook.xlsx.writeFile(filePath);
  }

  async createZipArchive(filePaths: string[], baseFileName: string): Promise<string> {
    const zipFilePath = path.join(this.EXPORT_FOLDER, `${baseFileName}.zip`);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level
    });

    this.logger.verbose(`Creating zip archive at ${baseFileName}.zip`);
    archive.pipe(output);
    filePaths.forEach(filePath => {
      archive.file(filePath, { name: path.basename(filePath) });
    });

    await archive.finalize();

    filePaths.forEach(filePath => fs.unlinkSync(filePath)); // Clean up individual files after zipping
    this.logger.verbose(
      `Export to excel data successfully with ${filePaths.length} files zipped into ${zipFilePath}`,
    );

    return zipFilePath;
  }
}
