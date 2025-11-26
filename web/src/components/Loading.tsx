import { Loader2 } from 'lucide-react';

const Loading = () => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-bg-primary">
            <Loader2 className="w-10 h-10 text-brand-cyan animate-spin" />
        </div>
    );
};

export default Loading;
