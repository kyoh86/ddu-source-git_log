import type { GatherArguments } from "@shougo/ddu-vim/source";
import * as fn from "@denops/std/function";
import { treePath2Filename } from "@shougo/ddu-vim/utils";
import type { Item } from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";
import { TextLineStream } from "@std/streams";
import { ChunkedStream } from "@hibiki/chunked-stream";

import type { ActionData } from "../../@ddu-kinds/git_commit/main.ts";
import { echoerrCommand } from "@kyoh86/denops-util/command";

type Params = {
  cwd?: string;
  showGraph: boolean;
  showAll: boolean;
  showReverse: boolean;
  commitOrdering: "date" | "author-date" | "topo";
  startingCommits: string[];
};

function formatLog(): string {
  const baseFormat = [
    "", // Graph
    "%H", // Hash
    "%aN", // Author
    "%ai", // AuthorDate
    "%cN", // Commit
    "%ci", // CommitDate
    "%s", // Subject
  ];
  return baseFormat.join("%x00");
}

function parseLogAction(
  cwd: string,
  line: string,
): ActionData {
  const elements = line.split("\x00");
  if (elements.length == 1) {
    return {
      kind: "graph",
      graph: elements[0],
    };
  }
  const [
    graph,
    hash,
    author,
    authDate,
    committer,
    commitDate,
    subject,
  ] = elements;

  return {
    kind: "commit",
    cwd,
    graph,
    hash,
    author,
    authDate,
    committer,
    commitDate,
    subject,
  };
}

function parseLogItem(
  cwd: string,
  line: string,
): Item<ActionData> {
  const action = parseLogAction(cwd, line);
  if (action.kind == "graph") {
    return {
      kind: "git_commit",
      word: "",
      display: `${action.graph}`,
      action,
    };
  }
  const displays = [];
  if (action.graph != "") {
    displays.push(action.graph);
  }
  displays.push(action.hash.substring(0, 6));
  displays.push(action.subject);
  return {
    kind: "git_commit",
    word: `${
      action.hash.substring(0, 6)
    } ${action.subject} by ${action.author}(${action.committer})`,
    display: displays.join(" "),
    action,
  };
}

export class Source extends BaseSource<Params, ActionData> {
  override kind = "git_commit";

  override gather(
    { denops, sourceOptions, sourceParams }: GatherArguments<Params>,
  ) {
    return new ReadableStream<Item<ActionData>[]>({
      async start(controller) {
        const path = treePath2Filename(sourceOptions.path);
        if (sourceParams.cwd) {
          console.error(
            `WARN: "cwd" for ddu-source-git_log is deprecated. Use sourceOptions.path instead.`,
          );
        }
        const cwd = sourceParams.cwd ??
          (path && path !== "" ? path : await fn.getcwd(denops));
        const args: string[] = [`--${sourceParams.commitOrdering}-order`];
        if (sourceParams.showGraph) args.push("--graph");
        if (sourceParams.showAll) args.push("--all");
        if (sourceParams.showReverse) args.push("--reverse");

        const { wait, pipeOut, finalize } = echoerrCommand(denops, "git", {
          args: [
            "log",
            "--pretty=" + formatLog(),
            ...args,
            ...sourceParams.startingCommits,
          ],
          cwd,
        });

        await Promise.all([
          pipeOut
            .pipeThrough(new TextLineStream())
            .pipeThrough(new ChunkedStream({ chunkSize: 1000 }))
            .pipeTo(
              new WritableStream<string[]>({
                write: (logs: string[]) => {
                  controller.enqueue(
                    logs.map((line) => parseLogItem(cwd, line)),
                  );
                },
              }),
            ),
          wait,
        ]).finally(async () => {
          await finalize();
          controller.close();
        });
      },
    });
  }

  override params(): Params {
    return {
      startingCommits: [],
      showGraph: false,
      showAll: false,
      showReverse: false,
      commitOrdering: "topo",
    };
  }
}
