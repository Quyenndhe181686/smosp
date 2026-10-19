package com.sep490_g47.smosp.auth.repository;

import com.sep490_g47.smosp.auth.entity.OauthIdentity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OauthIdentityRepository extends JpaRepository<OauthIdentity, UUID> {
    Optional<OauthIdentity> findByProviderAndProviderUid(String provider, String providerUid);
}
