import React, { useState, useEffect, useMemo } from 'react'
import { getMajors, getSpecializationsByMajor, getNarrowSpecsBySpecialization } from '../../services/catalogService'
import '../../pages/cm/CmCatalogPage.css'

export default function CmFilterSidebar({
    selectedSpecId,
    selectedNsId,
    mode,
    onSelectSpec,
    onSelectNs,
    showNs = true,
    allowSpecSelect = true,
    renderNsBadge
}) {
    const [majorsTree, setMajorsTree] = useState([])
    const [loading, setLoading] = useState(true)

    /* Filters state */
    const [search, setSearch] = useState('')
    const [filterMajor, setFilterMajor] = useState('')
    const [filterStatus, setFilterStatus] = useState('')

    /* Tree expand state */
    const [expandedMajors, setExpandedMajors] = useState({})
    const [expandedSpecs, setExpandedSpecs] = useState({})

    const toggleMajor = (id) => {
        setExpandedMajors(prev => ({ ...prev, [id]: !prev[id] }))
    }
    const toggleSpec = (id) => {
        setExpandedSpecs(prev => ({ ...prev, [id]: !prev[id] }))
    }

    useEffect(() => {
        const loadTree = async () => {
            try {
                setLoading(true)
                const majorsData = await getMajors()
                const activeMajors = majorsData.filter(m => m.isActive)
                
                const tree = await Promise.all(activeMajors.map(async (major) => {
                    const specsData = await getSpecializationsByMajor(major.id)
                    const activeSpecs = specsData.filter(s => s.isActive)
                    
                    const specsWithNs = await Promise.all(activeSpecs.map(async (spec) => {
                        let narrowSpecs = []
                        if (showNs) {
                            narrowSpecs = await getNarrowSpecsBySpecialization(spec.id)
                        }
                        return {
                            ...spec,
                            narrowSpecs
                        }
                    }))
                    
                    return {
                        ...major,
                        specializations: specsWithNs
                    }
                }))
                setMajorsTree(tree)

                // Auto expand first major and spec if any
                if (tree.length > 0) {
                     setExpandedMajors({ [tree[0].id]: true });
                     if (tree[0].specializations.length > 0) {
                         setExpandedSpecs({ [tree[0].specializations[0].id]: true });
                     }
                }
            } catch (err) {
                console.error("Failed to load catalog tree in sidebar:", err)
            } finally {
                setLoading(false)
            }
        }
        loadTree()
    }, [showNs])

    // Auto expand matching nodes when searching
    useEffect(() => {
        if (search.trim()) {
            const q = search.toLowerCase()
            const newExpandedMajors = {}
            const newExpandedSpecs = {}
            majorsTree.forEach(major => {
                let majorMatches = false
                major.specializations.forEach(spec => {
                    const specMatches = spec.name.toLowerCase().includes(q)
                    const nsMatches = showNs && spec.narrowSpecs.some(ns => ns.name.toLowerCase().includes(q))
                    if (specMatches || nsMatches) {
                        newExpandedSpecs[spec.id] = true
                        majorMatches = true
                    }
                })
                if (majorMatches) {
                    newExpandedMajors[major.id] = true
                }
            })
            setExpandedMajors(prev => ({ ...prev, ...newExpandedMajors }))
            setExpandedSpecs(prev => ({ ...prev, ...newExpandedSpecs }))
        }
    }, [search, majorsTree, showNs])

    /* Active filter tags */
    const activeTags = useMemo(() => {
        const tags = []
        if (filterMajor) {
            const majorName = majorsTree.find(m => m.id === filterMajor)?.name || 'Ngành'
            tags.push({
                label: `Ngành: ${majorName}`,
                clear: () => setFilterMajor('')
            })
        }
        if (filterStatus) {
            let statusLabel = 'Trạng thái'
            if (filterStatus === 'published') statusLabel = 'Published'
            if (filterStatus === 'draft') statusLabel = 'Draft'
            if (filterStatus === 'hidden') statusLabel = 'Ẩn'
            tags.push({
                label: `Trạng thái: ${statusLabel}`,
                clear: () => setFilterStatus('')
            })
        }
        return tags
    }, [filterMajor, filterStatus, majorsTree])

    /* Filter tree data logic */
    const filteredTree = useMemo(() => {
        return majorsTree.filter(major => {
            if (filterMajor && major.id !== filterMajor) return false
            if (filterStatus === 'hidden' && major.isActive) return false
            if (filterStatus && filterStatus !== 'hidden' && !major.isActive) return false
            
            if (!search.trim()) return true
            const q = search.toLowerCase()
            const nameMatch = major.name.toLowerCase().includes(q) || major.id === q
            
            const specMatch = major.specializations.some(s => {
                const specNameMatch = s.name.toLowerCase().includes(q) || s.id === q
                const nsMatch = showNs && s.narrowSpecs.some(ns => ns.name.toLowerCase().includes(q) || ns.id === q)
                return specNameMatch || nsMatch
            })
            
            return nameMatch || specMatch
        })
    }, [majorsTree, filterMajor, filterStatus, search, showNs])

    const getFilteredSpecs = (major) => {
        return major.specializations.filter(s => {
            if (filterStatus === 'published' && !s.isActive) return false
            if (filterStatus === 'hidden' && s.isActive) return false
            
            if (!search.trim()) return true
            const q = search.toLowerCase()
            const nameMatch = s.name.toLowerCase().includes(q) || s.id === q
            const nsMatch = showNs && s.narrowSpecs.some(ns => ns.name.toLowerCase().includes(q) || ns.id === q)
            return nameMatch || nsMatch
        })
    }

    const getFilteredNs = (spec) => {
        if (!showNs) return []
        return spec.narrowSpecs.filter(ns => {
            if (filterStatus === 'published' && !ns.isPublished) return false
            if (filterStatus === 'draft' && ns.isPublished) return false
            
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return ns.name.toLowerCase().includes(q) || ns.id === q
        })
    }

    return (
        <div className="cc-tree-panel" style={{ border: 'none', background: 'transparent', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div className="cc-tree-top" style={{ padding: '0 0 10px 0', borderBottom: '1.5px solid #e4e6ee', display: 'flex', flexDirection: 'column', gap: '7px', flexShrink: 0 }}>
                {/* Search */}
                <input
                    className="cc-tree-search"
                    placeholder="Tìm theo tên ngành..."
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />

                {/* Filter dropdowns */}
                <div className="cc-filter-row">
                    <select
                        className={`cc-filter-select${filterMajor ? ' active' : ''}`}
                        value={filterMajor}
                        onChange={e => setFilterMajor(e.target.value)}
                    >
                        <option value="">Tất cả ngành</option>
                        {majorsTree.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select
                        className={`cc-filter-select${filterStatus ? ' active' : ''}`}
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="hidden">Ẩn</option>
                    </select>
                </div>

                {/* Active filter tags */}
                {activeTags.length > 0 && (
                    <div className="cc-filter-tags" style={{ marginTop: '4px' }}>
                        {activeTags.map((t, i) => (
                            <span key={i} className="cc-filter-tag">
                                {t.label}
                                <button className="cc-filter-tag-x" onClick={t.clear} type="button">×</button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Tree Scroll Area */}
            <div className="cc-tree-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
                {loading ? (
                    <div className="cc-tree-empty">Đang tải bộ lọc...</div>
                ) : filteredTree.length === 0 ? (
                    <div className="cc-tree-empty">Không có kết quả</div>
                ) : (
                    filteredTree.map(major => (
                        <div key={major.id} className="cc-major-node">
                            <div className="cc-major-head">
                                <span 
                                    className={`cc-chevron${expandedMajors[major.id] ? ' open' : ''}`} 
                                    onClick={(e) => { e.stopPropagation(); toggleMajor(major.id) }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    ›
                                </span>
                                <span 
                                    className="cc-node-label" 
                                    onClick={() => toggleMajor(major.id)}
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                >
                                    {major.name}
                                </span>
                            </div>

                            {expandedMajors[major.id] && (
                                <div className="cc-spec-list">
                                    {getFilteredSpecs(major).map(spec => {
                                        const isSpecActive = selectedSpecId === spec.id && (mode === 'spec' || !selectedNsId)
                                        const specNsList = getFilteredNs(spec)
                                        return (
                                            <div key={spec.id} className="cc-spec-node">
                                                <div className={`cc-spec-head${isSpecActive ? ' sel' : ''}`}>
                                                    {showNs && specNsList.length > 0 ? (
                                                        <span 
                                                            className={`cc-chevron cc-chevron--sm${expandedSpecs[spec.id] ? ' open' : ''}`} 
                                                            onClick={(e) => { e.stopPropagation(); toggleSpec(spec.id) }}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            ›
                                                        </span>
                                                    ) : (
                                                        <span style={{ width: '10px', display: 'inline-block' }} />
                                                    )}
                                                    <span 
                                                        className="cc-spec-label" 
                                                        onClick={() => {
                                                            if (allowSpecSelect) {
                                                                onSelectSpec(spec.id)
                                                            } else {
                                                                toggleSpec(spec.id)
                                                            }
                                                        }}
                                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                                    >
                                                        {spec.name}
                                                    </span>
                                                </div>

                                                {showNs && expandedSpecs[spec.id] && specNsList.length > 0 && (
                                                    <div className="cc-ns-list">
                                                        {specNsList.map(ns => {
                                                            const isNsActive = selectedNsId === ns.id && (mode === 'ns' || selectedNsId)
                                                            return (
                                                                <div
                                                                    key={ns.id}
                                                                    className={`cc-ns-row${isNsActive ? ' sel' : ''}`}
                                                                    onClick={() => onSelectNs(ns.id, spec.id)}
                                                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                                                                >
                                                                    <span className="cc-ns-label" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ns.name}</span>
                                                                    {renderNsBadge && renderNsBadge(ns)}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    {major.specializations.length === 0 && (
                                        <div className="cc-tree-empty-sub">Chưa có chuyên ngành nào</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
