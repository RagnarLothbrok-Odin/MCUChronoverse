import { TimelineExplorer } from "./components/timeline-explorer";
import { chronology } from "./data/chronology";

export default function Home() {
    return <TimelineExplorer entries={chronology} />;
}
