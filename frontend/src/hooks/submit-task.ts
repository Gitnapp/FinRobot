import { write } from "../api/client";
import { useTaskReceipt } from "../components/task-center";
import type { Task } from "./tasks";

/** Submissions resolve on durable receipt; execution never controls page navigation. */
export function useSubmitTask() {
  const receive=useTaskReceipt();
  return async (input:{kind:"research"|"add_asset"|"refresh_asset"|"track_asset";symbol:string;focus?:string;list_id?:string},open=true)=>{
    const task=await write<Task>('/tasks',input);
    receive(task,{open});
    return task;
  };
}
