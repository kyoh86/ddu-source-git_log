import type { Denops } from "https://deno.land/x/ddu_vim@v3.4.2/deps.ts";
import {
  ActionArguments,
  ActionFlags,
  BaseKind,
  Previewer,
} from "https://deno.land/x/ddu_vim@v3.4.3/types.ts";
import type { DduItem } from "https://deno.land/x/ddu_vim@v3.4.2/types.ts";
import { passthrough } from "../ddu-source-git_log/message.ts";
import { GetPreviewerArguments } from "https://deno.land/x/ddu_vim@v3.4.3/base/kind.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.2.0/mod.ts";

export type ActionData = {
  cwd: string;
  hash: string;
  author: string;
  authDate: string;
  committer: string;
  commitDate: string;
  subject: string;
};

type Params = Record<never, never>;

async function callProcessByCommit(
  denops: Denops,
  items: DduItem[],
  subargs: string[],
) {
  if (items.length != 1) {
    await denops.call(
      "ddu#util#print_error",
      "invalid action calling: it can accept only one item",
      "ddu-kind-git_commit",
    );
    return ActionFlags.None;
  }
  const action = items[0].action as ActionData;
  const args = [
    ...subargs,
    action.hash,
  ];
  passthrough(
    denops,
    new Deno.Command("git", {
      args,
      cwd: action.cwd,
      stdin: "null",
      stderr: "piped",
      stdout: "piped",
    }).spawn(),
  );
  return ActionFlags.None;
}

export class Kind extends BaseKind<Params> {
  actions: Record<
    string,
    (args: ActionArguments<Params>) => Promise<ActionFlags>
  > = {
    reset: async (args) => {
      const params = ensure(args.actionParams, is.Record);
      const hard = ("hard" in params) && ensure(params.hard, is.Boolean);
      const gitArgs = ["reset"];
      if (hard) {
        gitArgs.push("--hard");
      }
      await callProcessByCommit(args.denops, args.items, gitArgs);
      return ActionFlags.None;
    },
  };

  getPreviewer(args: GetPreviewerArguments): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    return Promise.resolve({
      kind: "terminal",
      cmds: ["git", "show", action.hash],
    });
  }

  params(): Params {
    return {};
  }
}
