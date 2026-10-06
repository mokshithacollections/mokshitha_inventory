package com.mc.mc_ims.repository;

import com.mc.mc_ims.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    /** Login is case-insensitive — "Mokshitha@..." and "mokshitha@..." are the same account. */
    Optional<AppUser> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);
}
