package com.sep490_g47.smosp.tagmap.repository;

import com.sep490_g47.smosp.tagmap.entity.TagMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TagMapRepository extends JpaRepository<TagMap, UUID> {
    
    List<TagMap> findByNarrowSpecId(UUID narrowSpecId);
    
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM TagMap t WHERE t.narrowSpecId = :narrowSpecId")
    void deleteByNarrowSpecId(@org.springframework.data.repository.query.Param("narrowSpecId") UUID narrowSpecId);
}
