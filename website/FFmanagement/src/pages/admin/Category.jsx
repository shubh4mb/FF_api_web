import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from 'react-router-dom';
import { getCategories } from "@/api/categories";
import { useEffect, useState, useMemo } from "react";
import Table from "@/components/admin/Table";
import { Plus, Search, Filter, ArrowUpDown, ChevronRight, Layers, Sparkles, Copy, Check, X, FileText, ArrowRight } from "lucide-react";

export default function CategoryPage() {
  const navigate = useNavigate();
  const [categoriesData, setCategoriesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sortBy, setSortBy] = useState("hierarchy");
  const [selectedPromptCategory, setSelectedPromptCategory] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyPrompt = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  useEffect(() => {
    setLoading(true);
    const getCategoriesData = async () => {
      try {
        const response = await getCategories();
        if (response?.categories) {
          setCategoriesData(response.categories);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };
    getCategoriesData();
  }, []);

  // Quick lookup map for parent names
  const parentCategoryMap = useMemo(() => {
    const map = {};
    categoriesData.forEach(c => {
      if (c._id) map[c._id] = c;
    });
    return map;
  }, [categoriesData]);

  const filteredCategories = useMemo(() => {
    // 1. Filter by search, status, and level
    const filtered = categoriesData.filter((c) => {
      const parentName = c.ancestors?.parentName || parentCategoryMap[c.parentId]?.name || "";
      const matchesSearch =
        (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.slug && c.slug.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (parentName && parentName.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      if (statusFilter === "active") return c.isActive === true;
      if (statusFilter === "inactive") return c.isActive === false;

      if (levelFilter === "0") return c.level === 0;
      if (levelFilter === "1") return c.level === 1;

      return true;
    });

    // 2. Hierarchical sorting: Group Level 0 (parents) and immediately follow with their Level 1 (subcategories)
    if (sortBy === "hierarchy") {
      if (levelFilter === "1") {
        return [...filtered].sort((a, b) => {
          const pA = a.ancestors?.parentName || parentCategoryMap[a.parentId]?.name || "";
          const pB = b.ancestors?.parentName || parentCategoryMap[b.parentId]?.name || "";
          if (pA !== pB) return pA.localeCompare(pB);
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || "");
        });
      }

      const roots = [];
      const childrenByParent = new Map();

      filtered.forEach((cat) => {
        if (cat.level === 0) {
          roots.push(cat);
        } else if (cat.parentId) {
          const pId = cat.parentId.toString();
          if (!childrenByParent.has(pId)) {
            childrenByParent.set(pId, []);
          }
          childrenByParent.get(pId).push(cat);
        }
      });

      // Sort roots by sortOrder (asc) then name (asc)
      roots.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));

      // Sort children within each parent by sortOrder (asc) then name (asc)
      childrenByParent.forEach((children) => {
        children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));
      });

      const result = [];
      const visitedChildrenIds = new Set();

      roots.forEach((root) => {
        result.push(root);
        const children = childrenByParent.get(root._id?.toString()) || [];
        children.forEach((child) => {
          result.push(child);
          visitedChildrenIds.add(child._id?.toString());
        });
      });

      // Append any subcategories whose parent wasn't matched in roots (e.g. filtered by search)
      filtered.forEach((cat) => {
        if (cat.level !== 0 && !visitedChildrenIds.has(cat._id?.toString())) {
          result.push(cat);
        }
      });

      return result;
    }

    if (sortBy === "level-asc") {
      return [...filtered].sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));
    }

    if (sortBy === "level-desc") {
      return [...filtered].sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));
    }

    if (sortBy === "sortOrder") {
      return [...filtered].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));
    }

    if (sortBy === "name-asc") {
      return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    if (sortBy === "name-desc") {
      return [...filtered].sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    }

    if (sortBy === "latest") {
      return [...filtered].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return filtered;
  }, [categoriesData, searchTerm, statusFilter, levelFilter, sortBy, parentCategoryMap]);

  const CategoryColumns = [
    { header: "#", accessor: "_index", render: (_, __, i) => i + 1 },
    {
      header: "Logo",
      accessor: "logo",
      render: (value, row) => {
        const firstGenderLogo = row.logos ? Object.values(row.logos).find(l => l?.url)?.url : null;
        const displayUrl = value?.url || firstGenderLogo;

        return (
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white shadow-sm border border-gray-100 p-1">
            {displayUrl ? (
              <img src={displayUrl} alt="Logo" className="h-full w-full object-contain rounded-lg" />
            ) : (
              <span className="text-[10px] text-gray-400 font-medium">No Logo</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Gender Logos",
      accessor: "logos",
      render: (logos) => {
        const genders = [
          { key: 'MEN', label: 'Men', color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { key: 'WOMEN', label: 'Women', color: 'bg-purple-50 text-purple-700 border-purple-200' },
          { key: 'KIDS', label: 'Kids', color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { key: 'BOYS', label: 'Boys', color: 'bg-sky-50 text-sky-700 border-sky-200' },
          { key: 'GIRLS', label: 'Girls', color: 'bg-pink-50 text-pink-700 border-pink-200' },
        ];

        const hasAny = genders.some(g => logos?.[g.key]?.url);
        if (!hasAny) {
          return <span className="text-[11px] text-gray-400 italic">None</span>;
        }

        return (
          <div className="flex items-center gap-1.5 flex-wrap max-w-[240px]">
            {genders.map(g => {
              const item = logos?.[g.key];
              if (!item?.url) return null;
              return (
                <div
                  key={g.key}
                  title={`${g.label} Logo`}
                  className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg p-1 shadow-xs hover:shadow-sm transition-shadow"
                >
                  <img
                    src={item.url}
                    alt={g.label}
                    className="h-6 w-6 rounded object-contain bg-gray-50 border border-gray-100"
                  />
                  <span className={`text-[10px] font-semibold px-1 py-0.5 rounded border ${g.color}`}>
                    {g.label}
                  </span>
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      header: "Image",
      accessor: "image",
      render: (value) => (
        <div className="h-12 w-12 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
          {value?.url ? (
            <img src={value.url} alt="Category" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gray-50 flex items-center justify-center">
              <span className="text-[10px] text-gray-400 font-medium">No Image</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Name",
      accessor: "name",
      render: (value, row) => {
        if (row.level === 0) {
          return (
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm tracking-tight">{value}</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                Root
              </span>
            </div>
          );
        }
        const parentName = row.ancestors?.parentName || parentCategoryMap[row.parentId]?.name;
        return (
          <div className="flex items-center gap-2 pl-2">
            <span className="text-gray-300 font-mono text-sm">↳</span>
            <div className="flex flex-col">
              <span className="font-semibold text-gray-800">{value}</span>
              {parentName && (
                <span className="text-[11px] text-gray-400">
                  in <span className="text-gray-600 font-medium">{parentName}</span>
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    { header: "Slug", accessor: "slug", render: (value) => <span className="text-gray-500 text-xs font-mono bg-gray-50 px-2 py-1 rounded-md">{value}</span> },
    {
      header: "Level",
      accessor: "level",
      render: (value) => (
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${value === 0 ? 'bg-blue-500' : 'bg-purple-500'}`} />
          <span className="text-xs font-medium text-gray-700">
            {value === 0 ? 'Top Tier' : 'Sub Category'}
          </span>
        </div>
      )
    },
    {
      header: "Prompts (Front / Back / Close-Up)",
      accessor: "prompts",
      render: (_, row) => {
        const front = (row.promptFront || row.prompts?.front || "").trim();
        const back = (row.promptBack || row.prompts?.back || "").trim();
        const closeUp = (row.promptCloseUp || row.prompts?.closeUp || row.prompts?.closeup || "").trim();
        const hasAny = !!(front || back || closeUp || row.description?.trim());

        if (!hasAny) {
          return (
            <button
              type="button"
              onClick={() => navigate(`/admin/edit-category/${row._id}`)}
              className="text-[11px] text-gray-400 hover:text-purple-600 italic hover:underline transition"
              title="Configure 3 prompts in edit category"
            >
              + Set prompts
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={() => setSelectedPromptCategory(row)}
            className="flex items-center gap-1.5 flex-wrap cursor-pointer group py-1 text-left"
            title="Click to view & copy Front, Back, and Close-Up prompts"
          >
            {front ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 group-hover:bg-blue-100 transition">
                Front
              </span>
            ) : null}
            {back ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 group-hover:bg-purple-100 transition">
                Back
              </span>
            ) : null}
            {closeUp ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 group-hover:bg-amber-100 transition">
                Close-up
              </span>
            ) : null}
            <span className="text-[10px] text-gray-400 group-hover:text-purple-600 font-medium ml-0.5">
              View ↗
            </span>
          </button>
        );
      },
    },
    {
      header: "Order",
      accessor: "sortOrder",
      render: (value) => (
        <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          #{value ?? 0}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: "isActive",
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${value
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-rose-50 text-rose-700 border-rose-100"
          }`}>
          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          {value ? "Active" : "Archived"}
        </span>
      ),
    },
  ];

  const CategoryActions = [
    {
      label: "View Prompt",
      onClick: (row) => setSelectedPromptCategory(row),
      className: "inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors duration-200",
    },
    {
      label: "Edit",
      onClick: (row) => navigate(`/admin/edit-category/${row._id}`),
      className: "inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200",
    },
    {
      label: "View Items",
      onClick: (row) => navigate(`/admin/products/merchant/${row._id}`),
      className: "inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors duration-200",
    },
    {
      label: "Delete",
      onClick: (row) => console.log("Delete", row),
      className: "inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors duration-200",
    },
  ];

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Catalog Intelligence</h1>
          <p className="mt-1 text-sm text-gray-500">Manage and organize your product categories with precision.</p>
        </div>
        <Button
          onClick={() => navigate('/admin/add-category')}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 gap-2 px-6 py-6 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="h-5 w-5" />
          <span className="font-semibold text-base">New Category</span>
        </Button>
      </div>

      {/* Control Bar - Glassmorphism Effect */}
      <div className="sticky top-4 z-10 mb-6 flex flex-col gap-4 rounded-3xl border border-white/40 bg-white/70 p-4 shadow-xl backdrop-blur-xl lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search across categories or parents..."
            className="h-12 border-none bg-transparent pl-12 shadow-none focus-visible:ring-0 text-gray-700 placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 lg:border-none lg:pt-0">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-11 w-[165px] rounded-xl border-gray-100 bg-white shadow-sm ring-0 transition-all hover:bg-gray-50">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hierarchy">Tree (Grouped)</SelectItem>
                <SelectItem value="level-asc">Top Tier First</SelectItem>
                <SelectItem value="level-desc">Sub Category First</SelectItem>
                <SelectItem value="sortOrder">Sort Order (0-9)</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="latest">Recent First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="h-11 w-[145px] rounded-xl border-gray-100 bg-white shadow-sm ring-0 transition-all hover:bg-gray-50">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="0">Top Tier Only</SelectItem>
                <SelectItem value="1">Sub Categories Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-[130px] rounded-xl border-gray-100 bg-white shadow-sm ring-0 transition-all hover:bg-gray-50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <Table
        data={filteredCategories}
        columns={CategoryColumns}
        actions={CategoryActions}
      />

      {/* Category Prompt View & Reuse Modal */}
      {selectedPromptCategory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50/60 to-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">
                    {selectedPromptCategory.name}
                  </h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                    <span className="font-medium text-purple-700">
                      {selectedPromptCategory.level === 0 ? "Top Tier Category" : "Sub Category"}
                    </span>
                    {selectedPromptCategory.ancestors?.parentName && (
                      <>
                        <span>•</span>
                        <span>in {selectedPromptCategory.ancestors.parentName}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPromptCategory(null)}
                className="h-9 w-9 rounded-xl border border-gray-100 bg-white flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition shadow-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {(() => {
                const frontPrompt = (selectedPromptCategory.promptFront || selectedPromptCategory.prompts?.front || "").trim();
                const backPrompt = (selectedPromptCategory.promptBack || selectedPromptCategory.prompts?.back || "").trim();
                const closeUpPrompt = (selectedPromptCategory.promptCloseUp || selectedPromptCategory.prompts?.closeUp || selectedPromptCategory.prompts?.closeup || "").trim();
                const legacyDesc = (!frontPrompt && !backPrompt && !closeUpPrompt) ? (selectedPromptCategory.description || "").trim() : "";
                const hasAny = !!(frontPrompt || backPrompt || closeUpPrompt || legacyDesc);

                if (!hasAny) {
                  return (
                    <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center bg-gray-50/50">
                      <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">No prompts configured yet</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        You can set prompts for front, back, and close-up angles by editing this category.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Front View Prompt */}
                    {frontPrompt && (
                      <div className="border border-blue-100 bg-blue-50/20 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                            <span className="text-xs font-bold text-blue-900">Front View Prompt</span>
                            <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {frontPrompt.length} chars
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(frontPrompt, `${selectedPromptCategory._id}-front`)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition shadow-xs"
                          >
                            {copiedId === `${selectedPromptCategory._id}-front` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Front</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-white border border-blue-100/80 rounded-xl p-3 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                          {frontPrompt}
                        </div>
                      </div>
                    )}

                    {/* Back View Prompt */}
                    {backPrompt && (
                      <div className="border border-purple-100 bg-purple-50/20 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                            <span className="text-xs font-bold text-purple-900">Back View Prompt</span>
                            <span className="text-[10px] font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                              {backPrompt.length} chars
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(backPrompt, `${selectedPromptCategory._id}-back`)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-white border border-purple-200 hover:bg-purple-50 px-2.5 py-1 rounded-lg transition shadow-xs"
                          >
                            {copiedId === `${selectedPromptCategory._id}-back` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Back</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-white border border-purple-100/80 rounded-xl p-3 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                          {backPrompt}
                        </div>
                      </div>
                    )}

                    {/* Close-Up View Prompt */}
                    {closeUpPrompt && (
                      <div className="border border-amber-100 bg-amber-50/20 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            <span className="text-xs font-bold text-amber-900">Close-Up View Prompt</span>
                            <span className="text-[10px] font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                              {closeUpPrompt.length} chars
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(closeUpPrompt, `${selectedPromptCategory._id}-closeup`)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-white border border-amber-200 hover:bg-amber-50 px-2.5 py-1 rounded-lg transition shadow-xs"
                          >
                            {copiedId === `${selectedPromptCategory._id}-closeup` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Close-Up</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-white border border-amber-100/80 rounded-xl p-3 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                          {closeUpPrompt}
                        </div>
                      </div>
                    )}

                    {/* Legacy description fallback if present */}
                    {legacyDesc && (
                      <div className="border border-gray-200 bg-gray-50 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700">General Prompt / Description</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(legacyDesc, `${selectedPromptCategory._id}-desc`)}
                            className="text-[11px] font-medium text-gray-700 bg-white border border-gray-200 px-2.5 py-1 rounded-lg shadow-xs"
                          >
                            {copiedId === `${selectedPromptCategory._id}-desc` ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-3 font-mono text-xs text-slate-800 whitespace-pre-wrap">
                          {legacyDesc}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Category Context Info */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Slug</span>
                  <span className="text-xs font-mono text-gray-700">{selectedPromptCategory.slug}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Target Genders</span>
                  <span className="text-xs font-medium text-gray-700">
                    {selectedPromptCategory.allowedGenders?.join(', ') || 'MEN, WOMEN'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => navigate(`/admin/edit-category/${selectedPromptCategory._id}`)}
                className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-medium"
              >
                Edit Category
              </Button>

              <div className="flex items-center gap-2">
                {(() => {
                  const frontPrompt = selectedPromptCategory.promptFront || selectedPromptCategory.prompts?.front || "";
                  const backPrompt = selectedPromptCategory.promptBack || selectedPromptCategory.prompts?.back || "";
                  const closeUpPrompt = selectedPromptCategory.promptCloseUp || selectedPromptCategory.prompts?.closeUp || selectedPromptCategory.prompts?.closeup || "";
                  const legacyDesc = (!frontPrompt && !backPrompt && !closeUpPrompt) ? (selectedPromptCategory.description || "") : "";
                  const combined = [
                    frontPrompt ? `Front: ${frontPrompt}` : '',
                    backPrompt ? `Back: ${backPrompt}` : '',
                    closeUpPrompt ? `Close-Up: ${closeUpPrompt}` : '',
                    legacyDesc ? `Prompt: ${legacyDesc}` : '',
                  ].filter(Boolean).join("\n\n");

                  if (!combined) return null;

                  return (
                    <Button
                      onClick={() => handleCopyPrompt(combined, `${selectedPromptCategory._id}-all`)}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-1.5 text-xs font-semibold shadow-sm"
                    >
                      {copiedId === `${selectedPromptCategory._id}-all` ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied All!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy All 3 Prompts</span>
                        </>
                      )}
                    </Button>
                  );
                })()}

                <Button
                  onClick={() => {
                    const catId = selectedPromptCategory.level === 0 ? selectedPromptCategory._id : (selectedPromptCategory.parentId || '');
                    const subId = selectedPromptCategory.level === 1 ? selectedPromptCategory._id : '';
                    setSelectedPromptCategory(null);
                    navigate(`/admin/add-product?categoryId=${catId}&subCategoryId=${subId}`);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1.5 text-xs font-semibold shadow-sm"
                >
                  <span>Create Product</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
