interface WalletCardProps {
    icon?: React.ReactNode;
    iconBg?: string;
    label: string;
    value: string | React.ReactNode;
    subValue?: string | React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}

export function WalletCard({ icon, iconBg, label, value, subValue, actions, className = '' }: WalletCardProps) {
    return (
        <div className={`bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm flex flex-col gap-3 ${className}`}>
            <div className="flex items-center gap-3">
                {icon && (
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ background: iconBg || 'var(--bg-canvas)' }}
                    >
                        {icon}
                    </div>
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
            </div>

            <div>
                <div className="text-xl font-bold text-[var(--text-primary)] break-all leading-tight">{value}</div>
                {subValue && (
                    <div className="text-sm text-[var(--text-secondary)] mt-0.5">{subValue}</div>
                )}
            </div>

            {actions && (
                <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border-color)]">
                    {actions}
                </div>
            )}
        </div>
    );
}
