import type { Denops } from "https://deno.land/x/ddu_vim@v3.4.4/deps.ts";
import { TextLineStream } from "https://deno.land/std@0.196.0/streams/text_line_stream.ts";
import * as batch from "https://deno.land/x/denops_std@v5.0.1/batch/batch.ts";

export async function echoerr(denops: Denops, msg: string) {
  await batch.batch(denops, async (denops) => {
    await denops.cmd("echohl Error");
    await denops.cmd(`echomsg msg`, { msg: `[ddu-source-git_branch] ${msg}` });
    await denops.cmd("echohl None");
  });
}

export async function echomsg(denops: Denops, msg: string) {
  await batch.batch(denops, async (denops) => {
    await denops.cmd(`echomsg msg`, { msg: msg });
  });
}

export class ErrorStream extends WritableStream<string> {
  constructor(denops: Denops) {
    super({
      write: async (chunk, _controller) => {
        await echoerr(denops, chunk);
      },
    });
  }
}

export class MessageStream extends WritableStream<string> {
  constructor(denops: Denops) {
    super({
      write: async (chunk, _controller) => {
        await echomsg(denops, chunk);
      },
    });
  }
}

export async function pipe(
  denops: Denops,
  command: string | URL,
  options?: Omit<Deno.CommandOptions, "stdin" | "stderr" | "stdout">,
) {
  const { status, stderr, stdout } = new Deno.Command(command, {
    ...options,
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
  await stdout
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
    .pipeTo(new MessageStream(denops));
}
