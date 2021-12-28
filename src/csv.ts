import * as csv from "fast-csv";
import * as fs from "fs";
import { CsvOptionsInterface } from "sdz-agent-types";

class CSV {
  private fileNameCache: { [key: string]: number } = {};
  private fileSize: number;
  private legacy: boolean;
  private pad: string;

  constructor(config: boolean, fileSize?: number, pad: string = "000") {
    this.legacy = config;
    this.fileSize = fileSize;
    this.pad = pad;
  }

  /**
   * Generate a file name based at actual count.
   *
   * @param {string} path
   * @return {string}
   */
  private generateName(path: string): string {
    if (!this.fileNameCache[path]) {
      this.fileNameCache[path] = 0;
    }
    const file = path.split(/\.(?=[^\.]+$)/);
    const pad = `${this.pad}${this.fileNameCache[path]}`.slice(
      -this.pad.length
    );
    return [file[0], pad, file[1]].join(".");
  }

  /**
   * Search for a file with available size.
   *
   * @param {string} path
   * @returns {string}
   */
  private getFile(path): string {
    if (!this.fileSize) {
      return path;
    }

    while (true) {
      const name = this.generateName(path);
      if (!fs.existsSync(name)) {
        return name;
      }
      const size: number = fs.statSync(name).size / (1024 * 1024);
      if (size < this.fileSize) {
        return name
      } else {
        this.fileNameCache[path]++;
      }
    }
  }

  /**
   * Build CsvFormatterOptions.
   *
   * @return {CsvFormatterOptions}
   */
  private getFormat() {
    return {
      ...(this.legacy
        ? {
            delimiter: ";",
            writeHeaders: true,
          }
        : {
            delimiter: ",",
            quoteColumns: true,
            quoteHeaders: true,
          }),
      escape: '"',
      writeHeaders: true,
    };
  }

  /**
   * Read a CSV file.
   *
   * @param {string} path
   * @param {CsvOptionsInterface} options
   * @returns {Promise<any>}
   */
  read(path: string, options: CsvOptionsInterface) {
    return new Promise((resolve): any => {
      let result: Array<string> = [];
      fs.createReadStream(path)
        .on("error", (error) => {
          console.error(error);
        })
        .pipe(
          csv.parse({
            headers: true,
            ...options,
          })
        )
        .on("data", (row) => result.push(row))
        .on("end", () => resolve(result));
    });
  }

  /**
   * Write a file.
   *
   * @param {string} path
   * @param {array} data
   * @returns {Promise<void>}
   */
  async write(path: string, data: any[]) {
    const isAppend = fs.existsSync(path);
    const file = this.getFile(path);
    return new Promise((resolve) => {
      const buffer = fs.createWriteStream(file, { flags: "a" });

      if (isAppend) {
        buffer.write("\r\n");
      }

      buffer.on("finish", resolve);

      const stream = csv.format({
        ...this.getFormat(),
        headers: isAppend ? false : Object.keys(data[0]),
      });

      stream.pipe(buffer);

      for (const entity of data) {
        stream.write(entity);
      }

      stream.end();
    });
  }
}

export default CSV;
