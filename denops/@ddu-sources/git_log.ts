import type { GatherArguments } from "https://deno.land/x/ddu_vim@v3.4.3/base/source.ts";
import { fn } from "https://deno.land/x/ddu_vim@v3.4.3/deps.ts";
import { BaseSource, Item } from "https://deno.land/x/ddu_vim@v3.4.3/types.ts";
import { TextLineStream } from "https://deno.land/std@0.195.0/streams/text_line_stream.ts";
import { ChunkedStream } from "https://deno.land/x/chunked_stream@0.1.2/mod.ts";

import { ActionData } from "../@ddu-kinds/git_commit.ts";
import { ErrorStream } from "../ddu-source-git_log/message.ts";

type Params = {
  cwd?: string;
};

function formatLog(): string {
  return [
    "%H", // Hash
    "%aN", // Author
    "%ai", // AuthorDate
    "%cN", // Commit
    "%ci", // CommitDate
    "%s", // Subject
  ].join("%00");
}

function parseLog(line: string): Item<ActionData> {
  const [hash, author, authDate, committer, commitDate, subject] = line.split(
    "\x00",
  );
  return {
    word: `${hash.substring(0, 6)} ${subject} by ${author}(${committer})`,
    display: `${hash.substring(0, 6)} ${subject}`,
    action: { hash, author, authDate, committer, commitDate, subject },
  };
}

export class Source extends BaseSource<Params, ActionData> {
  override kind = "git_commit";

  override gather({ denops, sourceParams }: GatherArguments<Params>) {
    return new ReadableStream<Item<ActionData>[]>({
      async start(controller) {
        const cwd = sourceParams.cwd ?? await fn.getcwd(denops);
        const { status, stderr, stdout } = new Deno.Command("git", {
          args: [
            "log",
            "--pretty=" + formatLog(),
          ],
          cwd,
          stdin: "null",
          stderr: "piped",
          stdout: "piped",
        }).spawn();
        status.then((stat) => {
          if (!stat.success) {
            stderr
              .pipeThrough(new TextDecoderStream())
              .pipeThrough(new TextLineStream())
              .pipeTo(new ErrorStream(denops));
          }
        });
        stdout
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new TextLineStream())
          .pipeThrough(new ChunkedStream({ chunkSize: 1000 }))
          .pipeTo(
            new WritableStream<string[]>({
              write: (logs: string[]) => {
                controller.enqueue(logs.map(parseLog));
              },
            }),
          );
      },
    });
  }

  override params(): Params {
    return {};
  }
}
