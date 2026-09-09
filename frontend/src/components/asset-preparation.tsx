import { MathCurveLoader } from "@gitnapp/ui/components/ui/math-curve-loader";
import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { useTasks } from "../hooks/tasks";

export function AssetPreparation({symbol}:{symbol:string}) {
  const {data=[]}=useTasks();
  const task=data.find(task=>task.subject.symbol===symbol && task.kind!=='research' && ['queued','running'].includes(task.status));
  if(!task)return null;
  return <span className="asset-preparation" role="status"><MathCurveLoader size={16}/><InfoLabel label="数据准备中">正在{task.current_step || task.steps[task.completed_steps] || '等待处理'}，可能需要一些时间，可继续浏览。</InfoLabel></span>;
}
