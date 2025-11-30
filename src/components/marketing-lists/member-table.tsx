"use client";

import { useCallback, useEffect, useState } from "react";

type AudienceMember = {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    customer_fit_score?: number;
    status?: string;
    created_at: string;
};

export function MemberTable({ listId }: { listId: string }) {
    const [members, setMembers] = useState<AudienceMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [total, setTotal] = useState(0);

    const loadMembers = useCallback(async (pageNumber: number) => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/marketing-lists/${listId}/members?page=${pageNumber}&limit=20`
            );
            if (res.ok) {
                const data = await res.json();
                setMembers(data.members);
                setTotalPages(data.totalPages);
                setTotal(data.total);
                setPage(data.page);
            }
        } catch (err) {
            console.error("Failed to load members", err);
        } finally {
            setLoading(false);
        }
    }, [listId]);

    useEffect(() => {
        loadMembers(1);
    }, [loadMembers]);

    return (
        <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 bg-white">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                                Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                                Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                                Fit Score
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                                Joined
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-sm text-slate-500">
                                    Loading members...
                                </td>
                            </tr>
                        ) : members.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-sm text-slate-500">
                                    No members found in this list.
                                </td>
                            </tr>
                        ) : (
                            members.map((member) => (
                                <tr key={member.id} className="hover:bg-slate-50">
                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                                        {member.email}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                        {[member.first_name, member.last_name].filter(Boolean).join(" ") || "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                        {member.customer_fit_score ?? "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                                        <span
                                            className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${member.status === "active"
                                                ? "bg-green-100 text-green-800"
                                                : "bg-slate-100 text-slate-800"
                                                }`}
                                        >
                                            {member.status ?? "Unknown"}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                        {new Date(member.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                    <p className="text-sm text-slate-500">
                        Showing <span className="font-medium">{members.length}</span> of{" "}
                        <span className="font-medium">{total}</span> results
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => loadMembers(page - 1)}
                            disabled={page === 1 || loading}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => loadMembers(page + 1)}
                            disabled={page === totalPages || loading}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
